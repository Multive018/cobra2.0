import { analysis_vs_actual } from '@/lib/stack_pricing_utils';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const process_id = searchParams.get('process_id');

  // Validate Input
  if (!process_id) {
    return NextResponse.json({ message: 'Missing process_id parameter' }, { status: 400 });
  }

  const id = Number(process_id);
  if (isNaN(id)) {
    return NextResponse.json({ message: 'Invalid process_id provided' }, { status: 400 });
  }

  try {
    // Call the optimized function
    const data = await analysis_vs_actual(id);

    if (!data) {
      // Function returns undefined if no inputs found or validation fails
      return NextResponse.json({ 
        message: 'No analysis data found for this process ID, or inputs lack analysis IDs.' 
      }, { status: 404 });
    }
    console.log(data);

    // Return the calculated object
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error('Error in analysis_v_actual endpoint:', error);
    return NextResponse.json({ message: 'Internal Server Error', error: String(error) }, { status: 500 });
  }
}