import { RowDataPacket } from "mysql2";
import { query } from "./stock_movement_db";

// Interfaces for Type Safety
interface PendingBatch extends RowDataPacket {
  id: number;
  sti_number: string;
  balance_to_transfer: number;
  rent_cost: number;
  status: string;
  from_location:string;
}

interface AggregateResult extends RowDataPacket {
  val: number;
}

interface DashboardData {
  pendingBatches: PendingBatch[];
  partiallyPendingVolume: number;
  fullyPendingVolume: number;
  totalRentCosts: number;
  instructed: {
    lastWeek: number;
    overall: number;
  };
  delivered: {
    lastWeek: number;
    overall: number;
  };
  lossGain: {
    lastWeek: number;
    overall: number;
  };
  recentPnl: number;
  recentStockSummary: any; // Replace with specific interface if available
  recentGradeActivities: any[];
  recentStrategyActivities: any[];
}


export async function getInventoryDashboard(fromDate?: string, toDate?: string): Promise<DashboardData> {
  const isRange = !!(fromDate && toDate);
  const isSpecific = !!(fromDate && !toDate);
  const dateParams = isRange ? [fromDate, toDate] : [fromDate];

  // Helper for date clauses based on column names
  const getClause = (col: string) => {
    if (isRange) return `${col} BETWEEN ? AND ?`;
    if (isSpecific) return `${col} = ?`;
    // Default to latest date available in the system
    return `${col} = (SELECT MAX(date) FROM daily_stock_summaries)`;
  };

  // --- 1. Queries ---

  // A. Stock Summaries (Opening/Closing, WIP, B4P)
  const summaryQuery = `SELECT date, total_opening_qty, total_xbs_closing_stock, total_wip_qty, total_b4p_qty FROM daily_stock_summaries WHERE ${getClause('date')} ${isRange ? 'ORDER BY date ASC' : 'LIMIT 1'}`;
  const gradeBaseQuery = `SELECT grade, opening_qty, xbs_closing_stock FROM daily_grade_activities WHERE ${getClause('date')}`;
  const strategyBaseQuery = `SELECT strategy, opening_qty, xbs_closing_stock FROM daily_strategy_activities WHERE ${getClause('date')}`;

  // B. Inbound & Logistics
  const totalInboundQuery = `SELECT COALESCE(SUM(delivered_qty), 0) as val FROM instructed_batches WHERE ${getClause('arrival_date')}`;
  const gradeInboundQuery = `SELECT grade, SUM(delivered_qty) as val FROM instructed_batches WHERE ${getClause('arrival_date')} GROUP BY grade`;
  const strategyInboundQuery = `SELECT strategy, SUM(delivered_qty) as val FROM instructed_batches WHERE ${getClause('arrival_date')} GROUP BY strategy`;

  // Standard Aggregates (STI & Batches) for Last Week Comparisons
  const stiAggregatesQuery = isRange 
    ? `SELECT 0 as last_week, SUM(instructed_qty) as overall FROM stock_transfer_instructions WHERE instructed_date BETWEEN ? AND ?`
    : `SELECT
        SUM(CASE WHEN YEARWEEK(instructed_date, 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1) THEN instructed_qty ELSE 0 END) as last_week,
        SUM(instructed_qty) as overall
       FROM stock_transfer_instructions`;

  const batchAggregatesQuery = isRange
    ? `SELECT 
         0 as delivered_last_week, 
         SUM(delivered_qty) as delivered_overall, 
         0 as loss_last_week, 
         SUM(loss_gain_qty) as loss_overall 
       FROM instructed_batches 
       WHERE arrival_date BETWEEN ? AND ?`
    : `SELECT
        SUM(CASE WHEN YEARWEEK(arrival_date, 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1) THEN delivered_qty ELSE 0 END) as delivered_last_week,
        SUM(delivered_qty) as delivered_overall,
        SUM(CASE WHEN YEARWEEK(arrival_date, 1) = YEARWEEK(CURDATE() - INTERVAL 1 WEEK, 1) THEN loss_gain_qty ELSE 0 END) as loss_last_week,
        SUM(loss_gain_qty) as loss_overall
       FROM instructed_batches`;

  // C. Outbound (daily_outbounds)
  const totalOutboundQuery = `SELECT COALESCE(SUM(dispatched_quantity), 0) as val FROM daily_outbounds WHERE ${getClause('dispatch_date')}`;
  const gradeOutboundQuery = `SELECT dispatched_grade as grade, SUM(dispatched_quantity) as val FROM daily_outbounds WHERE ${getClause('dispatch_date')} GROUP BY dispatched_grade`;
  const strategyOutboundQuery = `SELECT dispatched_strategy as strategy, SUM(dispatched_quantity) as val FROM daily_outbounds WHERE ${getClause('dispatch_date')} GROUP BY dispatched_strategy`;

  // D. Adjustments (stock_adjustment)
  const totalAdjustQuery = `SELECT COALESCE(SUM(adjusted_quantity), 0) as val FROM stock_adjustment WHERE ${getClause('adjustment_date')}`;
  const gradeAdjustQuery = `SELECT grade, SUM(adjusted_quantity) as val FROM stock_adjustment WHERE ${getClause('adjustment_date')} GROUP BY grade`;
  const strategyAdjustQuery = `SELECT strategy, SUM(adjusted_quantity) as val FROM stock_adjustment WHERE ${getClause('adjustment_date')} GROUP BY strategy`;

  // E. Processing (daily_processes + children)
  const gradeProcessQuery = `
    SELECT dgp.grade, SUM(dgp.input_qty) as to_qty, SUM(dgp.output_qty) as from_qty, SUM(dgp.processing_loss_gain_qty) as plg
    FROM daily_processes dp JOIN daily_grade_processing dgp ON dp.id = dgp.process_id
    WHERE ${getClause('dp.processing_date')} GROUP BY dgp.grade`;

  const strategyProcessQuery = `
    SELECT dsp.strategy, SUM(dsp.input_qty) as to_qty, SUM(dsp.output_qty) as from_qty, SUM(dsp.processing_loss_gain_qty) as plg
    FROM daily_processes dp JOIN daily_strategy_processing dsp ON dp.id = dsp.process_id
    WHERE ${getClause('dp.processing_date')} GROUP BY dsp.strategy`;

  const totalProcessQuery = `
    SELECT COALESCE(SUM(input_qty), 0) as total_to, COALESCE(SUM(output_qty), 0) as total_from 
    FROM daily_processes WHERE ${getClause('processing_date')}`;

  // F. P&L and Logistics
  const pnlQuery = `SELECT SUM(pnl) as total_pnl FROM daily_processes WHERE ${getClause('processing_date')}`;
  const pendingBatchesQuery = `
    SELECT ib.*, sti.sti_number, COALESCE((GREATEST(DATEDIFF(CURDATE(), ib.due_date), 1) * (ib.balance_to_transfer / 50) * 0.45), 0) as rent_cost
    FROM instructed_batches ib JOIN stock_transfer_instructions sti ON ib.sti_id = sti.id
    WHERE ib.status != 'Completed' ${isRange ? 'AND sti.instructed_date BETWEEN ? AND ?' : ''}`;

  try {
    const activeParams = (isRange || isSpecific) ? dateParams : [];
    
    const [
      summaryResRaw, gradeBaseRaw, strategyBaseRaw, 
      inboundTotalRaw, gradeInboundRaw, strategyInboundRaw,
      outboundTotalRaw, gradeOutboundRaw, strategyOutboundRaw,
      adjustTotalRaw, gradeAdjustRaw, strategyAdjustRaw,
      gradeProcessRaw, strategyProcessRaw,
      pnlResRaw, pendingResRaw,
      stiStatsRaw, batchStatsRaw,
      totalProcessRaw
    ] = await Promise.all([
      query<any[]>({ query: summaryQuery, values: activeParams }),
      query<any[]>({ query: gradeBaseQuery, values: activeParams }),
      query<any[]>({ query: strategyBaseQuery, values: activeParams }),
      query<any[]>({ query: totalInboundQuery, values: activeParams }),
      query<any[]>({ query: gradeInboundQuery, values: activeParams }), 
      query<any[]>({ query: strategyInboundQuery, values: activeParams }),
      query<any[]>({ query: totalOutboundQuery, values: activeParams }),
      query<any[]>({ query: gradeOutboundQuery, values: activeParams }),
      query<any[]>({ query: strategyOutboundQuery, values: activeParams }),
      query<any[]>({ query: totalAdjustQuery, values: activeParams }),
      query<any[]>({ query: gradeAdjustQuery, values: activeParams }),
      query<any[]>({ query: strategyAdjustQuery, values: activeParams }),
      query<any[]>({ query: gradeProcessQuery, values: activeParams }),
      query<any[]>({ query: strategyProcessQuery, values: activeParams }),
      query<any[]>({ query: pnlQuery, values: activeParams }),
      query<any[]>({ query: pendingBatchesQuery, values: isRange ? activeParams : [] }),
      query<any[]>({ query: stiAggregatesQuery, values: isRange ? activeParams : [] }),
      query<any[]>({ query: batchAggregatesQuery, values: isRange ? activeParams : [] }),
      query<any[]>({ query: totalProcessQuery, values: activeParams })
    ]);

    const summaryRes = summaryResRaw || [];
    const gradeBase = gradeBaseRaw || [];
    const strategyBase = strategyBaseRaw || [];
    const inboundTotal = inboundTotalRaw || [];
    const gradeInbound = gradeInboundRaw || [];
    const strategyInbound = strategyInboundRaw || [];
    const outboundTotal = outboundTotalRaw || [];
    const gradeOutbound = gradeOutboundRaw || [];
    const strategyOutbound = strategyOutboundRaw || [];
    const adjustTotal = adjustTotalRaw || [];
    const gradeAdjust = gradeAdjustRaw || [];
    const strategyAdjust = strategyAdjustRaw || [];
    const gradeProcess = gradeProcessRaw || [];
    const strategyProcess = strategyProcessRaw || [];
    const pnlRes = pnlResRaw || [];
    const pendingRes = pendingResRaw || [];
    const stiStats = stiStatsRaw?.[0] || { last_week: 0, overall: 0 };
    const batchStats = batchStatsRaw?.[0] || { delivered_last_week: 0, delivered_overall: 0, loss_last_week: 0, loss_overall: 0 };
    const totalProcess = totalProcessRaw?.[0] || { total_to: 0, total_from: 0 };

    const createMap = (arr: any[], key: string) => new Map(arr.map(i => [i[key], i]));

    const first = summaryRes[0];
    const last = summaryRes[summaryRes.length - 1];
    
    // Aggregating WIP and B4P across a range (average or last depending on business logic, here we take last)
    const finalStockSummary = first ? {
      date: last.date,
      total_opening_qty: first.total_opening_qty,
      total_xbs_closing_stock: last.total_xbs_closing_stock,
      total_inbound_qty: Number(inboundTotal[0]?.val || 0),
      total_outbound_qty: Number(outboundTotal[0]?.val || 0),
      total_stock_adjustment_qty: Number(adjustTotal[0]?.val || 0),
      total_wip_qty: Number(last.total_wip_qty || 0),
      total_b4p_qty: Number(last.total_b4p_qty || 0),
      total_to_processing_qty: Number(totalProcess.total_to || 0),
      total_from_processing_qty: Number(totalProcess.total_from || 0)
    } : null;

    const mergeActivities = (base: any[], key: string, inMap: Map<any, any>, outMap: Map<any, any>, adjMap: Map<any, any>, procMap: Map<any, any>) => {
      const allKeys = new Set([...base.map(b => b[key]), ...inMap.keys(), ...outMap.keys(), ...adjMap.keys(), ...procMap.keys()]);
      
      return Array.from(allKeys).map((k, index) => {
        const b = base.find(x => x[key] === k) || {};
        const i = inMap.get(k) || {};
        const o = outMap.get(k) || {};
        const a = adjMap.get(k) || {};
        const p = procMap.get(k) || {};

        return {
          id: `${key}-${k}-${index}`,
          [key]: k,
          opening_qty: Number(b.opening_qty || 0),
          xbs_closing_stock: Number(b.xbs_closing_stock || 0),
          inbound_qty: Number(i.val || 0),
          outbound_qty: Number(o.val || 0),
          stock_adjustment_qty: Number(a.val || 0),
          to_processing_qty: Number(p.to_qty || 0),
          from_processing_qty: Number(p.from_qty || 0),
          loss_gain_qty: Number(p.plg || 0)
        };
      });
    };

    const finalGradeActivities = mergeActivities(
      gradeBase, 'grade', 
      createMap(gradeInbound, 'grade'), createMap(gradeOutbound, 'grade'), 
      createMap(gradeAdjust, 'grade'), createMap(gradeProcess, 'grade')
    );

    const finalStrategyActivities = mergeActivities(
      strategyBase, 'strategy', 
      createMap(strategyInbound, 'strategy'), createMap(strategyOutbound, 'strategy'), 
      createMap(strategyAdjust, 'strategy'), createMap(strategyProcess, 'strategy')
    );

    let partiallyPendingVolume = 0;
    let fullyPendingVolume = 0;
    let totalRentCosts = 0;
    pendingRes.forEach(b => {
      totalRentCosts += Number(b.rent_cost || 0);
      if (b.status?.toLowerCase().includes('partially')) partiallyPendingVolume += Number(b.balance_to_transfer);
      else fullyPendingVolume += Number(b.balance_to_transfer);
    });

    return {
      pendingBatches: pendingRes,
      partiallyPendingVolume,
      fullyPendingVolume,
      totalRentCosts,
      instructed: { 
        lastWeek: Number(stiStats.last_week || 0), 
        overall: Number(stiStats.overall || 0) 
      }, 
      delivered: { 
        overall: Number(batchStats.delivered_overall || 0), 
        lastWeek: Number(batchStats.delivered_last_week || 0) 
      },
      lossGain: { 
        overall: Number(batchStats.loss_overall || 0), 
        lastWeek: Number(batchStats.loss_last_week || 0) 
      },
      recentPnl: Number(pnlRes[0]?.total_pnl || 0),
      recentStockSummary: finalStockSummary,
      recentGradeActivities: finalGradeActivities,
      recentStrategyActivities: finalStrategyActivities
    };

  } catch (error) {
    console.error("Dashboard calculation failed", error);
    throw error;
  }
}


export interface DailyProcess extends RowDataPacket {
  id: number;
  summary_id: number;
  processing_date: Date;
  process_type: string;
  process_number: string;
  input_qty: number;
  output_qty: number;
  milling_loss: number;
  processing_loss_gain_qty: number;
  input_value: number;
  output_value: number;
  pnl: number;
}

// Interfaces for the detailed breakdowns
export interface StrategyProcessing extends RowDataPacket {
  id: number;
  process_id: number;
  strategy: string;
  input_qty: number;
  output_qty: number;
  // Add other fields as necessary
}

export interface GradeProcessing extends RowDataPacket {
  id: number;
  process_id: number;
  grade: string;
  input_qty: number;
  output_qty: number;
  // Add other fields as necessary
}

export async function getDailyProcesses(fromDate?: string, toDate?: string): Promise<DailyProcess[]> {
  // If dates are provided, use them. 
  // If not, default to the first day of current month -> last day of current month.
  const isRange = !!(fromDate && toDate);
  
  const sql = `
    SELECT * FROM daily_processes WHERE processing_date BETWEEN ${isRange ? '?' : "DATE_FORMAT(CURDATE(), '%Y-%m-01')"} AND ${isRange ? '?' : "LAST_DAY(CURDATE())"} ORDER BY processing_date DESC`;

  const values = isRange ? [fromDate, toDate] : [];

  try {
    const results = await query<DailyProcess[]>({ query: sql, values });
    return results || [];
  } catch (error) {
    console.error("Failed to fetch daily processes", error);
    throw error;
  }
}

export async function getProcessingDetails(processId: number) {
  const strategyQuery = "SELECT * FROM daily_strategy_processing WHERE process_id = ?";
  const gradeQuery = "SELECT * FROM daily_grade_processing WHERE process_id = ?";

  try {
    // Execute both queries in parallel for maximum efficiency
    const [strategies, grades] = await Promise.all([
      query<StrategyProcessing[]>({ query: strategyQuery, values: [processId] }),
      query<GradeProcessing[]>({ query: gradeQuery, values: [processId] })
    ]);

    return {
      strategies: strategies || [],
      grades: grades || []
    };
  } catch (error) {
    console.error(`Failed to fetch details for process ${processId}`, error);
    throw error;
  }
}