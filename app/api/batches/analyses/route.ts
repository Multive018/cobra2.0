import { NextResponse } from 'next/server';
import pool from '@/lib/stock_movement_db';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

interface BreakdownItem {
  [key: string]: [string, number][];
}

interface IncomingData {
  analysis_type: string;
  analysis_number: string;
  sale_number: string | null;
  grade: string | null;
  qc_quality?: string; 
  profile_print_score?: number;
  sca_defect_count: number;
  primary_defects_percentage: number;
  secondary_defects_percentage: number;
  grade_percentages: {
    grade_aa: number;
    grade_ab: number;
    grade_abc: number;
    grade_grinder: number;
  };
  screen_size_distribution: { [key: string]: number };
  defects_by_screensize_breakdown: BreakdownItem;
}

// Maps Analysis Type Name (from Python) -> Shortcode (for DB Process Number)
const process_shortcodes: { [key: string]: string } = {
    'Bulking': 'BULK',
    'Final - Bulking': 'FBULK',
    'Color Sorting': 'CS',
    'Regrading': 'RG',
    'Gravity Separation': 'GS',
    'Blowing': 'BLOW',
    'Hand Picking': 'HP',
    'Pre-Cleaning': 'PC',
    'Vacuum-Packing': 'VP'
    // Add 'Rebagging': 'REBAG' if needed in the future
};

// Helper to extract Outturn from Analysis Number (e.g., "12KN0004" from "SomeString12KN0004")
function extractOutturn(analysisNumber: string): string | null {
    // Regex: 2 digits, 2 letters, 4 digits (case insensitive)
    const match = analysisNumber.match(/(\d{2}[a-zA-Z]{2}\d{4})/);
    if (match) {
        return match[0].toUpperCase();
    }
    return null;
}

// Helper to pad number to 5 digits
function padCounter(numStr: string): string {
    // Extract numeric part if string contains non-numeric chars
    const num = parseInt(numStr.replace(/\D/g, ''), 10); 
    if (isNaN(num)) return numStr; // Fallback
    return num.toString().padStart(5, '0');
}

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;

  try {
    const data: IncomingData = await request.json();

    // --- DEBUG LOGGING ---
    console.log("------------------------------------------------");
    console.log("📥 RECEIVED POST DATA:");
    console.log(JSON.stringify(data, null, 2)); 
    console.log("------------------------------------------------");

    // 1. Calculate Foreign Matter
    let foreignMatterTotal = 0.0;
    if (data.defects_by_screensize_breakdown) {
      Object.values(data.defects_by_screensize_breakdown).forEach((screenDefects) => {
        screenDefects.forEach(([defectName, percentage]) => {
          if (defectName.toLowerCase().includes('foreign m')) { 
            foreignMatterTotal += Number(percentage);
          }
        });
      });
    }

    const qcQuality = data.qc_quality || 'Standard'; 

    if (!pool) throw new Error("Database pool not initialized");
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // --- 2. Insert into batch_analysis (Initialize mapped = False) ---
    const insertParentQuery = `
      INSERT INTO batch_analysis (
        analysis_type, sale_number, analysis_number, qc_grade, 
        profile_print_score, sca_defect_count, qc_quality, 
        primary_defects_percentage, secondary_defects_percentage, 
        forein_matter_percentage, grade_aa_percentage, 
        grade_ab_percentage, grade_abc_percentage, grade_grinder_percentage,
        mapped
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const parentValues = [
      data.analysis_type,
      data.sale_number,
      data.analysis_number,
      data.grade,
      data.profile_print_score || null,
      data.sca_defect_count || 0,
      qcQuality,
      data.primary_defects_percentage,
      data.secondary_defects_percentage,
      foreignMatterTotal,
      data.grade_percentages.grade_aa,
      data.grade_percentages.grade_ab,
      data.grade_percentages.grade_abc,
      data.grade_percentages.grade_grinder,
      false // Default mapped = False
    ];

    const [parentResult] = await connection.query<ResultSetHeader>(insertParentQuery, parentValues);
    const analysisId = parentResult.insertId;

    // --- 3. Insert Breakdowns (Standard logic) ---
    // B. Insert into screensize_breakdown
    const screenSizes = Object.entries(data.screen_size_distribution);
    if (screenSizes.length > 0) {
      const breakdownQuery = `INSERT INTO screensize_breakdown (analysis_id, screen_size, percentage) VALUES ?`;
      const breakdownValues = screenSizes.map(([size, pct]) => [analysisId, parseInt(size), pct]);
      await connection.query(breakdownQuery, [breakdownValues]);
    }

    // C. Insert into class_by_screensize
    const classRows: any[] = [];
    Object.entries(data.defects_by_screensize_breakdown).forEach(([screenSize, defects]) => {
      defects.forEach(([defectName, pct]) => {
        classRows.push([analysisId, parseInt(screenSize), defectName, pct]);
      });
    });

    if (classRows.length > 0) {
      const classQuery = `INSERT INTO class_by_screensize (analysis_id, screen_size, class, percentage) VALUES ?`;
      await connection.query(classQuery, [classRows]);
    }

    // --- 4. MAPPING LOGIC ---
    let mapped = false;
    const analysisType = data.analysis_type;

    // A. Catalogue Summary Update (Auction or Direct Sale)
    if (analysisType === 'Auction' || analysisType === 'Direct Sale') {
        let updateCatalogueQuery = '';
        let updateParams: any[] = [];

        if (analysisType === 'Direct Sale') {
            const outturn = extractOutturn(data.analysis_number);
            if (outturn) {
                // Find row: sale_type='DS', analysis_id IS NULL, match outturn
                updateCatalogueQuery = `
                    UPDATE catalogue_summary 
                    SET analysis_id = ? 
                    WHERE sale_type = 'DS' 
                      AND analysis_id IS NULL 
                      AND outturn = ?
                    LIMIT 1
                `;
                updateParams = [analysisId, outturn];
            } else {
                console.warn(`[Mapping] Could not extract outturn from Direct Sale analysis number: ${data.analysis_number}`);
            }
        } else if (analysisType === 'Auction') {
            // Find row: sale_type='Auction', analysis_id IS NULL, lot_number matches analysis_number
            updateCatalogueQuery = `
                UPDATE catalogue_summary 
                SET analysis_id = ? 
                WHERE sale_type = 'Auction' 
                  AND analysis_id IS NULL 
                  AND lot_number = ?
                LIMIT 1
            `;
            updateParams = [analysisId, data.analysis_number];
        }

        if (updateCatalogueQuery) {
            console.log(`[Mapping] Attempting to update catalogue_summary for ${analysisType}. Query params: [${updateParams.join(', ')}]`);
            const [catalogueResult] = await connection.query<ResultSetHeader>(updateCatalogueQuery, updateParams);
            if (catalogueResult.affectedRows > 0) {
                mapped = true;
                console.log(`[Mapping] SUCCESS: Mapped Analysis ID ${analysisId} to Catalogue Summary. (Affected Rows: ${catalogueResult.affectedRows})`);
            } else {
                console.warn(`[Mapping] FAILED: No matching Catalogue Summary row found for ${analysisType} analysis.`);
            }
        }
    } 
    // B. Daily Strategy Processing Update (Process Map Types)
    else if (process_shortcodes.hasOwnProperty(analysisType)) {
        
        // 1. Construct Process Number
        const shortcode = process_shortcodes[analysisType];
        const counterCode = padCounter(data.analysis_number);
        
        let processNumber = "";
        // Special case for Rebagging if it ever appears
        if (analysisType === 'Rebagging' || shortcode === 'REBAG') {
             processNumber = `REBAG${counterCode}`;
        } else {
             processNumber = `${shortcode}-${counterCode}`;
        }
        
        console.log(`[Mapping] Strategy Processing Logic:`);
        console.log(`   > Analysis Type: ${analysisType}`);
        console.log(`   > Constructed Process Number search: ${processNumber}`);

        // 2. Determine target batch
        const findBatchesQuery = `
            SELECT id, batch_number, strategy, output_qty 
            FROM daily_strategy_processing 
            WHERE batch_number LIKE CONCAT(?, '%') 
              AND output_qty > 0
              AND analysis_id IS NULL
        `;
        
        const [candidateBatches] = await connection.query<RowDataPacket[]>(findBatchesQuery, [processNumber]);
        
        let targetBatchId: number | null = null;
        let targetBatchNumber: string | null = null; // New Variable to track the specific batch number

        if (candidateBatches.length === 1) {
            targetBatchId = candidateBatches[0].id;
            targetBatchNumber = candidateBatches[0].batch_number;
        } else if (candidateBatches.length > 1) {
            // Multiple matches (Regrading, Color Sort, etc.) -> Filter by Grade
            const gradeToMatch = data.grade;
            console.log(`   > Multiple batches found (${candidateBatches.length}). Filtering by Grade: '${gradeToMatch}'`);
            
            if (gradeToMatch) {
                const matchedBatch = candidateBatches.find(b => 
                    b.batch_number.toUpperCase().includes(gradeToMatch.toUpperCase())
                );
                if (matchedBatch) {
                    targetBatchId = matchedBatch.id;
                    targetBatchNumber = matchedBatch.batch_number;
                    console.log(`   > Match found using grade: Batch ${matchedBatch.batch_number} (ID: ${matchedBatch.id})`);
                } else {
                     console.warn(`   > [Mapping Warning] No batch matched grade '${gradeToMatch}'. Candidates: ${candidateBatches.map(b => b.batch_number).join(', ')}`);
                }
            } else {
                console.warn(`   > [Mapping Warning] Multiple batches found but analysis has no grade to filter by.`);
            }
        } else {
             console.warn(`   > [Mapping Warning] No eligible batches found for process number ${processNumber}.`);
        }

        if (targetBatchNumber) {
            // UPDATED: Update ALL rows with the matching batch_number, not just the single ID found
            const updateStrategyQuery = `
                UPDATE daily_strategy_processing 
                SET analysis_id = ? 
                WHERE batch_number = ?
            `;
            
            console.log(`[Mapping] EXECUTING BATCH UPDATE on daily_strategy_processing:`);
            console.log(`   > Setting analysis_id = ${analysisId}`);
            console.log(`   > WHERE batch_number = '${targetBatchNumber}'`);
            
            const [updateResult] = await connection.query<ResultSetHeader>(updateStrategyQuery, [analysisId, targetBatchNumber]);
            
            if (updateResult.affectedRows > 0) {
                mapped = true;
                console.log(`[Mapping] SUCCESS: Mapped Analysis ID ${analysisId} to ${updateResult.affectedRows} row(s) with Batch Number '${targetBatchNumber}'.`);
            }
        }
    }

    // --- 5. Update Mapped Flag on Analysis ---
    if (mapped) {
        await connection.query(
            `UPDATE batch_analysis SET mapped = TRUE WHERE id = ?`, 
            [analysisId]
        );
    }

    await connection.commit();

    return NextResponse.json({ 
      message: 'Analysis saved successfully', 
      id: analysisId,
      mapped: mapped 
    }, { status: 201 });

  } catch (error: any) {
    console.error("Save Analysis Error:", error);

    if (connection) {
      await connection.rollback();
    }

    return NextResponse.json({ 
      message: 'Failed to save analysis', 
      error: error.message 
    }, { status: 500 });

  } finally {
    if (connection) connection.release();
  }
}