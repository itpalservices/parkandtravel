export interface FlightInfo {
  valid: boolean;
  flightNumber?: string;
  airline?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  status?: string;
  error?: string;
}

export async function validateFlightNumber(flightNumber: string): Promise<FlightInfo> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  
  if (!apiKey) {
    console.error('AVIATIONSTACK_API_KEY not configured');
    return { valid: false, error: 'Flight validation service not configured' };
  }

  const cleanFlightNumber = flightNumber.trim().toUpperCase();
  
  if (!cleanFlightNumber || cleanFlightNumber.length < 3) {
    return { valid: false, error: 'Invalid flight number format' };
  }

  try {
    const response = await fetch(
      `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${cleanFlightNumber}`
    );

    if (!response.ok) {
      console.error('Aviationstack API error:', response.status);
      return { valid: false, error: 'Flight validation service unavailable' };
    }

    const data = await response.json();

    if (data.error) {
      console.error('Aviationstack API error:', data.error);
      return { valid: false, error: 'Flight validation service error' };
    }

    if (data.data && data.data.length > 0) {
      const flight = data.data[0];
      return {
        valid: true,
        flightNumber: flight.flight?.iata || cleanFlightNumber,
        airline: flight.airline?.name,
        departureAirport: flight.departure?.airport,
        arrivalAirport: flight.arrival?.airport,
        departureTime: flight.departure?.scheduled,
        arrivalTime: flight.arrival?.scheduled,
        status: flight.flight_status,
      };
    }

    return { valid: false, error: 'Flight not found' };
  } catch (error) {
    console.error('Error validating flight number:', error);
    return { valid: false, error: 'Failed to validate flight number' };
  }
}
