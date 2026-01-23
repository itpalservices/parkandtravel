interface FlightData {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    iata: string;
    scheduled: string;
  };
  arrival: {
    airport: string;
    iata: string;
    scheduled: string;
  };
  airline: {
    name: string;
    iata: string;
  };
  flight: {
    number: string;
    iata: string;
  };
}

interface AviationstackResponse {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: FlightData[];
}

export interface FlightValidationResult {
  valid: boolean;
  flightNumber?: string;
  airline?: string;
  departure?: {
    airport: string;
    iata: string;
    scheduled: string;
  };
  arrival?: {
    airport: string;
    iata: string;
    scheduled: string;
  };
  error?: string;
}

export async function validateFlightNumber(flightNumber: string): Promise<FlightValidationResult> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  
  if (!apiKey) {
    return {
      valid: false,
      error: 'Flight validation service is not configured',
    };
  }

  const cleanedFlightNumber = flightNumber.replace(/\s+/g, '').toUpperCase();
  
  if (!cleanedFlightNumber || cleanedFlightNumber.length < 3) {
    return {
      valid: false,
      error: 'Invalid flight number format',
    };
  }

  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${cleanedFlightNumber}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        valid: false,
        error: 'Failed to validate flight number',
      };
    }

    const data = await response.json() as AviationstackResponse;

    if (data.data && data.data.length > 0) {
      const flight = data.data[0];
      return {
        valid: true,
        flightNumber: flight.flight.iata,
        airline: flight.airline.name,
        departure: {
          airport: flight.departure.airport,
          iata: flight.departure.iata,
          scheduled: flight.departure.scheduled,
        },
        arrival: {
          airport: flight.arrival.airport,
          iata: flight.arrival.iata,
          scheduled: flight.arrival.scheduled,
        },
      };
    } else {
      return {
        valid: false,
        error: 'Flight not found',
      };
    }
  } catch (error) {
    console.error('Error validating flight number:', error);
    return {
      valid: false,
      error: 'Failed to validate flight number',
    };
  }
}
