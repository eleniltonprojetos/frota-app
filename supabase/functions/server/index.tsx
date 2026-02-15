import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "x-access-token", "Cache-Control", "Pragma", "apikey", "Expires"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to validate user token
async function validateUser(c: any) {
  console.log('=== VALIDATE USER ===');
  
  const authHeader = c.req.header('Authorization');
  const xAccessToken = c.req.header('x-access-token');
  
  let token = '';
  
  // Prefer x-access-token if present (bypasses Gateway auth check issues)
  if (xAccessToken) {
    console.log('Using x-access-token for validation');
    token = xAccessToken;
  } else if (authHeader) {
    console.log('Using Authorization header for validation');
    token = authHeader.replace('Bearer ', '').trim();
  }
  
  if (!token) {
    console.log('ERROR: No token provided');
    return { error: 'No token provided', status: 401 };
  }
  
  console.log('Token extracted:', token.substring(0, 10) + '...' + token.substring(token.length - 5));

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    console.log('ERROR: Missing environment variables');
    return { error: 'Server configuration error', status: 500 };
  }

  // Create client with explicit configuration for server-side usage
  // persistSession: false is CRITICAL for Edge Functions
  const supabase = createClient(
    supabaseUrl,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    }
  );

  // Explicitly pass the token to getUser
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error) {
    console.log(`Auth validation failed with ANON_KEY: ${error.message}`);
    
    // Fallback: Try verifying with SERVICE_ROLE_KEY
    // This handles cases where RLS might be interfering or ANON_KEY context is insufficient
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (serviceRoleKey) {
        console.log('Attempting fallback validation with SERVICE_ROLE_KEY...');
        const supabaseAdmin = createClient(
            supabaseUrl,
            serviceRoleKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                }
            }
        );
        
        const { data: { user: adminUser }, error: adminError } = await supabaseAdmin.auth.getUser(token);
        
        if (adminUser) {
            console.log('✓ User validated successfully with SERVICE_ROLE_KEY:', adminUser.id);
            return { user: adminUser };
        }
        console.log(`Fallback validation failed: ${adminError?.message}`);
    }

    return { error: error.message, status: 401 };
  }

  if (!user) {
    console.log('No user found');
    return { error: 'User not found', status: 401 };
  }

  console.log('✓ User validated successfully:', user.id);
  return { user };
}

// Helper function to get a Service Role client with proper configuration
// We use this instead of kv_store.tsx to ensure persistSession: false is used
function getAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    }
  );
}

// Health check endpoint
app.get("/make-server-e4206deb/health", (c) => {
  return c.json({ status: "ok" });
});

// Test token endpoint - verifies if a token is valid
app.get("/make-server-e4206deb/test-token", async (c) => {
  try {
    console.log('=== TEST TOKEN REQUEST ===');
    const authHeader = c.req.header('Authorization');
    const xAccessToken = c.req.header('x-access-token');
    console.log('Authorization header:', authHeader);
    console.log('x-access-token header:', xAccessToken ? 'Present' : 'Missing');
    
    // Prefer x-access-token
    let accessToken = xAccessToken;
    if (!accessToken && authHeader) {
        accessToken = authHeader.split(' ')[1];
    }
    
    console.log('Access token to test:', accessToken ? `${accessToken.substring(0, 50)}...` : 'none');
    
    if (!accessToken) {
      return c.json({ error: 'No token provided', valid: false }, 400);
    }
    
    // Try with ANON_KEY
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );
    
    console.log('Testing with ANON_KEY...');
    const { data: anonData, error: anonError } = await supabaseAnon.auth.getUser(accessToken);
    
    console.log('ANON_KEY result:', {
      user: anonData?.user?.id || null,
      error: anonError?.message || null
    });
    
    if (anonData?.user) {
      return c.json({
        valid: true,
        method: 'ANON_KEY',
        userId: anonData.user.id,
        email: anonData.user.email,
        metadata: anonData.user.user_metadata
      });
    }
    
    // Try with SERVICE_ROLE_KEY
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    console.log('Testing with SERVICE_ROLE_KEY...');
    const { data: serviceData, error: serviceError } = await supabaseService.auth.getUser(accessToken);
    
    console.log('SERVICE_ROLE_KEY result:', {
      user: serviceData?.user?.id || null,
      error: serviceError?.message || null
    });
    
    if (serviceData?.user) {
      return c.json({
        valid: true,
        method: 'SERVICE_ROLE_KEY',
        userId: serviceData.user.id,
        email: serviceData.user.email,
        metadata: serviceData.user.user_metadata
      });
    }
    
    return c.json({
      valid: false,
      anonError: anonError?.message,
      serviceError: serviceError?.message
    }, 401);
  } catch (error) {
    console.log(`Error testing token: ${error}`);
    return c.json({ error: "Internal server error", valid: false }, 500);
  }
});

// Signup endpoint
app.post("/make-server-e4206deb/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      return c.json({ error: "Email, senha, nome e tipo de usuário são obrigatórios" }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check if admin registration is enabled
    if (role === 'admin') {
      console.log('Checking admin registration setting for new admin signup...');
      const { data, error: settingError } = await supabase
        .from("kv_store_e4206deb")
        .select("value")
        .eq("key", "settings:admin_registration_enabled");
        
      if (settingError) {
         console.log('Error fetching setting:', settingError);
      }
      
      const settingValue = data?.[0]?.value;
      console.log('Admin registration setting value from DB:', settingValue);
      
      // Strict check: Must be explicitly true
      // If not set (undefined/null), it defaults to false (disabled) to match UI behavior
      const isEnabled = settingValue === true;
      
      if (!isEnabled) {
        console.log('Admin registration is disabled (or not set). Request blocked.');
        return c.json({ error: "O cadastro de novos administradores está temporariamente desativado." }, 403);
      }
      console.log('Admin registration is enabled. Proceeding.');
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log(`Signup error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ user: data.user });
  } catch (error) {
    console.log(`Error during signup: ${error}`);
    return c.json({ error: "Erro interno do servidor durante o cadastro" }, 500);
  }
});

// Create trip endpoint
app.post("/make-server-e4206deb/trips", async (c) => {
  try {
    console.log('=== CREATE TRIP REQUEST ===');
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;
    console.log('Authenticated user:', user.id);

    console.log('Getting request body...');
    const body = await c.req.json();
    console.log('Trip data:', body);
    
    const { vehiclePlate, vehicleColor, vehicleModel, kmStart, timeStart, destination } = body;

    if (!vehiclePlate || !vehicleColor || !vehicleModel || kmStart === undefined || kmStart === null || !timeStart || !destination) {
      console.log('Missing required fields');
      return c.json({ error: "Todos os campos da viagem são obrigatórios" }, 400);
    }

    const supabase = getAdminClient();

    // Check availability before creating trip
    const { data: tripsData, error: tripsError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", "trip:%");

    if (!tripsError && tripsData) {
      const allTrips = tripsData.map(r => r.value).filter((t: any) => t.vehiclePlate === vehiclePlate);
      
      // Sort trips to find the latest one - using ROBUST logic matching GET /vehicles
      allTrips.sort((a: any, b: any) => {
          const getTimestamp = (trip: any) => {
               // Prefer createdAt
               if (trip.createdAt) {
                   const t = new Date(trip.createdAt).getTime();
                   return isNaN(t) ? 0 : t;
               }
               return 0;
          };
          
          const timeA = getTimestamp(a);
          const timeB = getTimestamp(b);
          
          if (timeA !== timeB) {
              return timeB - timeA;
          }
          
          // Tie-breaker: If created at exact same time (duplicate submission or quick retry),
          // Prefer the COMPLETED one as the "latest" to ensure vehicle is freed.
          if (a.status === 'completed' && b.status !== 'completed') return -1; // a comes first (completed)
          if (b.status === 'completed' && a.status !== 'completed') return 1;  // b comes first (completed)
          
          return 0;
      });
      
      const latestTrip = allTrips[0];
      
      if (latestTrip && latestTrip.status === 'in_progress') {
         console.log(`Vehicle ${vehiclePlate} is already in use by ${latestTrip.userName}`);
         return c.json({ error: `Veículo em uso por ${latestTrip.userName}. Aguarde a finalização.` }, 409);
      }
    }

    const tripId = crypto.randomUUID();
    const trip = {
      id: tripId,
      userId: user.id,
      userName: user.user_metadata?.name || 'Unknown',
      vehiclePlate,
      vehicleColor,
      vehicleModel,
      kmStart,
      timeStart,
      destination,
      kmEnd: null,
      timeEnd: null,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
    };

    console.log('Saving trip to KV store...');
    
    // 1. Save the trip object
    const { error: tripError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `trip:${tripId}`,
        value: trip
      });

    if (tripError) {
      throw new Error(`Database error saving trip: ${tripError.message}`);
    }

    // 2. Save the user_trip index
    const { error: indexError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `user_trip:${user.id}:${tripId}`,
        value: tripId
      });

    if (indexError) {
      // Try to rollback trip creation if index fails (optional but good practice)
      console.log(`Error saving user index: ${indexError.message}`);
      // Not deleting the trip to avoid complex rollback logic in this simple setup, 
      // but logging it is important.
      throw new Error(`Database error saving user index: ${indexError.message}`);
    }
    
    console.log('Trip created successfully:', tripId);
    return c.json({ trip });
  } catch (error: any) {
    console.log(`Error creating trip: ${error}`);
    return c.json({ error: `Erro interno ao criar viagem: ${error.message || error}` }, 500);
  }
});

// Complete trip endpoint
app.put("/make-server-e4206deb/trips/:id/complete", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;

    const tripId = c.req.param('id');
    const body = await c.req.json();
    const { kmEnd, timeEnd } = body;

    if (!kmEnd || !timeEnd) {
      return c.json({ error: "KM final e horário final são obrigatórios" }, 400);
    }

    const supabase = getAdminClient();
    
    // Get trip
    const { data: tripData, error: tripError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", `trip:${tripId}`);

    if (tripError) {
      throw new Error(`Database error fetching trip: ${tripError.message}`);
    }

    const trip = tripData?.[0]?.value;
    
    if (!trip) {
      return c.json({ error: "Viagem não encontrada" }, 404);
    }

    if (trip.userId !== user.id) {
      return c.json({ error: "Acesso negado" }, 403);
    }

    const updatedTrip = {
      ...trip,
      kmEnd,
      timeEnd,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `trip:${tripId}`,
        value: updatedTrip
      });

    if (updateError) {
      throw new Error(`Database error updating trip: ${updateError.message}`);
    }

    return c.json({ trip: updatedTrip });
  } catch (error) {
    console.log(`Error completing trip: ${error}`);
    return c.json({ error: "Erro interno ao finalizar viagem" }, 500);
  }
});

// Delete trip endpoint
app.delete("/make-server-e4206deb/trips/:id", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;
    const tripId = c.req.param('id');
    const supabase = getAdminClient();

    // Get trip to verify ownership
    const { data: tripData, error: tripError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", `trip:${tripId}`);

    if (tripError) {
      throw new Error(`Database error fetching trip: ${tripError.message}`);
    }

    const trip = tripData?.[0]?.value;
    
    if (!trip) {
      // Auto-healing: If trip object doesn't exist but user is trying to delete it,
      // it might be a ghost reference. Let's try to clean up the user index just in case.
      // This fixes "Trip not found" errors when the data is inconsistent.
      console.log(`Trip object ${tripId} not found. Attempting to clean up potential ghost index for user ${user.id}...`);
      
      const { error: indexError } = await supabase
        .from("kv_store_e4206deb")
        .delete()
        .eq("key", `user_trip:${user.id}:${tripId}`);
        
      if (indexError) {
        console.log('Error cleaning ghost index:', indexError);
      } else {
        console.log('Ghost index cleanup attempt finished.');
      }

      // Return success anyway so the UI removes it from the list
      return c.json({ success: true, message: "Trip cleaned up (ghost)" });
    }

    // Allow user to delete their own trips, or admin to delete any
    if (trip.userId !== user.id && user.user_metadata?.role !== 'admin') {
      return c.json({ error: "Acesso negado" }, 403);
    }

    // Delete trip object
    const { error: delError } = await supabase
      .from("kv_store_e4206deb")
      .delete()
      .eq("key", `trip:${tripId}`);

    if (delError) {
      throw new Error(`Database error deleting trip: ${delError.message}`);
    }

    // Delete user index
    // We don't check for error here because the index might not exist if data is corrupted,
    // and we want to ensure the trip is gone.
    await supabase
      .from("kv_store_e4206deb")
      .delete()
      .eq("key", `user_trip:${trip.userId}:${tripId}`);

    console.log(`Trip ${tripId} deleted by user ${user.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting trip: ${error}`);
    return c.json({ error: "Erro interno ao excluir viagem" }, 500);
  }
});

// Get user trips
app.get("/make-server-e4206deb/trips", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;
    const supabase = getAdminClient();

    // 1. Get trip IDs from user index
    const { data: userTripKeys, error: keysError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", `user_trip:${user.id}:%`);

    if (keysError) {
      throw new Error(`Database error fetching trip keys: ${keysError.message}`);
    }

    const tripIds = userTripKeys?.map(r => r.value) || [];

    if (tripIds.length === 0) {
      return c.json({ trips: [] });
    }

    // 2. Fetch the actual trips
    // We need to construct the keys: "trip:UUID"
    const tripKeys = tripIds.map(id => `trip:${id}`);
    
    const { data: tripsData, error: tripsError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .in("key", tripKeys);

    if (tripsError) {
      throw new Error(`Database error fetching trips content: ${tripsError.message}`);
    }

    const rawTrips = tripsData?.map(r => r.value) || [];
    
    // Deduplicate trips by ID, preferring the completed ones
    const tripsMap = new Map();
    
    for (const trip of rawTrips) {
        if (!trip || !trip.id) continue;
        
        if (!tripsMap.has(trip.id)) {
            tripsMap.set(trip.id, trip);
        } else {
            const existing = tripsMap.get(trip.id);
            // Prefer completed trips over in_progress
            if (trip.status === 'completed' && existing.status !== 'completed') {
                tripsMap.set(trip.id, trip);
            }
            // If both completed, prefer the one with later completedAt
            else if (trip.status === 'completed' && existing.status === 'completed') {
                 const timeA = trip.completedAt ? new Date(trip.completedAt).getTime() : 0;
                 const timeB = existing.completedAt ? new Date(existing.completedAt).getTime() : 0;
                 if (timeA > timeB) {
                     tripsMap.set(trip.id, trip);
                 }
            }
        }
    }

    const trips = Array.from(tripsMap.values());

    // Client-side sorting by creation date desc (optional but good)
    trips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ trips });
  } catch (error) {
    console.log(`Error fetching trips: ${error}`);
    return c.json({ error: "Erro interno ao buscar viagens" }, 500);
  }
});

// Get all trips (admin only)
app.get("/make-server-e4206deb/admin/trips", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;

    // Check if user is admin
    if (user.user_metadata?.role !== 'admin' && user.user_metadata?.role !== 'super_admin') {
      return c.json({ error: 'Acesso negado - Requer acesso de administrador' }, 403);
    }

    const supabase = getAdminClient();
    
    const { data: tripsData, error: tripsError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", "trip:%");

    if (tripsError) {
      throw new Error(`Database error fetching all trips: ${tripsError.message}`);
    }

    const trips = tripsData?.map(r => r.value) || [];

    return c.json({ trips });
  } catch (error) {
    console.log(`Error fetching all trips: ${error}`);
    return c.json({ error: "Erro interno ao buscar todas as viagens" }, 500);
  }
});

// Get vehicle maintenance info
app.get("/make-server-e4206deb/vehicles/:plate/maintenance", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const plate = c.req.param('plate');
    const supabase = getAdminClient();
    
    // Get all trips
    // Optimization: In a real DB we would query where value->>'vehiclePlate' = plate
    // For now, we fetch all trips to maintain compatibility with existing logic but use robust client
    const { data: tripsData, error: tripsError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", "trip:%");

    if (tripsError) {
      throw new Error(`Database error fetching trips for maintenance: ${tripsError.message}`);
    }

    const allTrips = tripsData?.map(r => r.value) || [];
    
    const vehicleTrips = allTrips
      .filter((trip: any) => trip.vehiclePlate === plate && trip.status === 'completed');

    // Calculate total km
    const totalKm = vehicleTrips.reduce((sum: number, trip: any) => {
      return sum + ((trip.kmEnd || 0) - (trip.kmStart || 0));
    }, 0);

    // Get last oil change
    const { data: oilData, error: oilError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", `vehicle:${plate}:last_oil_change`);

    if (oilError) {
      throw new Error(`Database error fetching oil change info: ${oilError.message}`);
    }

    const lastOilChange = oilData?.[0]?.value || 0;
    const kmSinceOilChange = totalKm - lastOilChange;
    const needsOilChange = kmSinceOilChange >= 10000;

    return c.json({
      plate,
      totalKm,
      lastOilChange,
      kmSinceOilChange,
      needsOilChange,
    });
  } catch (error) {
    console.log(`Error fetching maintenance info: ${error}`);
    return c.json({ error: "Erro interno ao buscar informações de manutenção" }, 500);
  }
});

// Record oil change
app.post("/make-server-e4206deb/vehicles/:plate/oil-change", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const user = authResult.user!;
    const plate = c.req.param('plate');
    const body = await c.req.json();
    const { currentKm } = body;

    if (!currentKm) {
      return c.json({ error: "KM atual é obrigatório" }, 400);
    }

    const supabase = getAdminClient();

    // 1. Update the "Current State" for alerts (existing logic)
    const { error: saveError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `vehicle:${plate}:last_oil_change`,
        value: currentKm
      });

    if (saveError) {
      throw new Error(`Database error recording oil change: ${saveError.message}`);
    }

    // 2. Create a Historical Record (New Logic)
    const historyId = crypto.randomUUID();
    const historyEntry = {
      id: historyId,
      plate,
      type: 'oil_change',
      km: currentKm,
      date: new Date().toISOString(),
      userId: user.id,
      userName: user.user_metadata?.name || 'Usuário',
      notes: `Troca de óleo realizada em ${currentKm}km`
    };

    const { error: historyError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `history:maintenance:${plate}:${historyId}`,
        value: historyEntry
      });

    if (historyError) {
      console.log('Error saving history (non-fatal):', historyError);
    }

    return c.json({ success: true, message: "Oil change recorded and history saved" });
  } catch (error) {
    console.log(`Error recording oil change: ${error}`);
    return c.json({ error: "Erro interno ao registrar troca de óleo" }, 500);
  }
});

// Get vehicle maintenance history
app.get("/make-server-e4206deb/vehicles/:plate/maintenance-history", async (c) => {
  try {
    const authResult = await validateUser(c);
    if (authResult.error) return c.json({ error: authResult.error }, authResult.status);

    const plate = c.req.param('plate');
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", `history:maintenance:${plate}:%`);

    if (error) throw error;

    const history = data?.map(d => d.value) || [];
    
    // Sort by date descending
    history.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return c.json({ history });
  } catch (error: any) {
    console.log(`Error fetching history: ${error}`);
    return c.json({ error: "Erro ao buscar histórico" }, 500);
  }
});

// Create vehicle (admin only)
app.post("/make-server-e4206deb/vehicles", async (c) => {
  try {
    console.log('=== CREATE VEHICLE REQUEST ===');
    console.log('Headers:', c.req.header('Authorization') ? 'Authorization present' : 'No authorization');
    
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      console.log('Authorization error:', authResult.error);
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;
    console.log('User authenticated:', user.id, 'Role:', user.user_metadata?.role);

    // Check if user is admin
    if (user.user_metadata?.role !== 'admin' && user.user_metadata?.role !== 'super_admin') {
      console.log('User is not admin, access denied');
      return c.json({ error: 'Acesso negado - Requer acesso de administrador' }, 403);
    }

    const body = await c.req.json();
    console.log('Request body:', body);
    
    // Normalize plate
    if (body.plate) {
        body.plate = body.plate.trim().toUpperCase();
    }
    
    const { plate, model, color, year, brand } = body;

    if (!plate || !model || !color || !year || !brand) {
      console.log('Missing required fields:', { plate, model, color, year, brand });
      return c.json({ error: "Todos os campos do veículo são obrigatórios" }, 400);
    }

    // Check if vehicle already exists
    const supabase = getAdminClient();
    const { data: existingData, error: getError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", `vehicle:${plate}`);

    if (getError) {
      console.log('Error checking existing vehicle:', getError);
      throw new Error(`Database error checking existence: ${getError.message}`);
    }

    if (existingData && existingData.length > 0) {
      const existingVehicle = existingData[0].value;
      console.log('Vehicle already exists. Converting CREATE to UPSERT/UPDATE for plate:', plate);
      
      // We will proceed to overwrite/update the vehicle, but we try to preserve original metadata
      // This solves the "Vehicle already exists" error by treating it as an update,
      // which is more user-friendly in this context than blocking.
      
      const vehicle = {
        plate,
        model,
        color,
        year,
        brand,
        // Preserve original creation info if available
        createdAt: existingVehicle.createdAt || new Date().toISOString(),
        createdBy: existingVehicle.createdBy || user.id,
        // Add update info
        updatedAt: new Date().toISOString(),
        updatedBy: user.id
      };
      
      console.log('Upserting vehicle:', vehicle);
      const { error: upsertError } = await supabase
        .from("kv_store_e4206deb")
        .upsert({
          key: `vehicle:${plate}`,
          value: vehicle
        });

    if (upsertError) {
        console.log('Error saving vehicle:', upsertError);
        throw new Error(`Database error saving vehicle: ${upsertError.message}`);
      }
      
      return c.json({ vehicle });
    }

    const vehicle = {
      plate,
      model,
      color,
      year,
      brand,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    console.log('Creating vehicle:', vehicle);
    const { error: upsertError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `vehicle:${plate}`,
        value: vehicle
      });

    if (upsertError) {
      console.log('Error saving vehicle:', upsertError);
      throw new Error(`Database error saving vehicle: ${upsertError.message}`);
    }
    
    console.log('Vehicle created successfully');

    return c.json({ vehicle });
  } catch (error: any) {
    console.log(`Error creating vehicle: ${error}`);
    console.log('Stack:', error.stack);
    return c.json({ error: `Erro interno ao criar veículo: ${error.message}` }, 500);
  }
});

// Update vehicle (admin only)
app.put("/make-server-e4206deb/vehicles/:plate", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;

    // Check if user is admin
    if (user.user_metadata?.role !== 'admin' && user.user_metadata?.role !== 'super_admin') {
      return c.json({ error: 'Acesso negado - Requer acesso de administrador' }, 403);
    }

    const plateParam = c.req.param('plate');
    const body = await c.req.json();
    
    // Normalize plate
    if (body.plate) {
        body.plate = body.plate.trim().toUpperCase();
    }
    
    const { plate, model, color, year, brand } = body;

    const supabase = getAdminClient();
    
    // Check if vehicle exists (using the URL param which is the CURRENT/OLD plate)
    const { data: existingData, error: getError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", `vehicle:${plateParam}`);

    if (getError) {
      throw new Error(`Database error fetching vehicle: ${getError.message}`);
    }

    if (!existingData || existingData.length === 0) {
      return c.json({ error: "Veículo não encontrado" }, 404);
    }

    const existingVehicle = existingData[0].value;
    const targetPlate = plate || plateParam;

    // If plate is changing, check if new plate ALREADY exists
    if (targetPlate !== plateParam) {
        const { data: collisionData } = await supabase
             .from("kv_store_e4206deb")
             .select("value")
             .eq("key", `vehicle:${targetPlate}`);
             
        if (collisionData && collisionData.length > 0) {
            return c.json({ error: "Já existe um veículo cadastrado com a nova placa informada." }, 409);
        }
    }
    
    const updatedVehicle = {
        ...existingVehicle,
        plate: targetPlate,
        model: model || existingVehicle.model,
        color: color || existingVehicle.color,
        year: year || existingVehicle.year,
        brand: brand || existingVehicle.brand,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id
    };

    // Save new/updated vehicle
    const { error: updateError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `vehicle:${targetPlate}`,
        value: updatedVehicle
      });

    if (updateError) {
      throw new Error(`Database error updating vehicle: ${updateError.message}`);
    }

    // If plate changed (RENAME operation), delete old record and migrate auxiliary data
    if (targetPlate !== plateParam) {
        console.log(`Renaming vehicle from ${plateParam} to ${targetPlate}`);
        
        // 1. Delete old vehicle record
        const { error: delError } = await supabase
            .from("kv_store_e4206deb")
            .delete()
            .eq("key", `vehicle:${plateParam}`);
            
        if (delError) {
             console.log(`Warning: Failed to delete old vehicle record ${plateParam}: ${delError.message}`);
        }
            
        // 2. Migrate oil change record
        const { data: oilData } = await supabase
            .from("kv_store_e4206deb")
            .select("value")
            .eq("key", `vehicle:${plateParam}:last_oil_change`);
            
        if (oilData && oilData.length > 0) {
            const lastOilChange = oilData[0].value;
            await supabase
                .from("kv_store_e4206deb")
                .upsert({
                    key: `vehicle:${targetPlate}:last_oil_change`,
                    value: lastOilChange
                });
            
            await supabase
                .from("kv_store_e4206deb")
                .delete()
                .eq("key", `vehicle:${plateParam}:last_oil_change`);
        }
    }

    return c.json({ vehicle: updatedVehicle });
  } catch (error: any) {
    console.log(`Error updating vehicle: ${error}`);
    return c.json({ error: `Erro interno ao atualizar veículo: ${error.message}` }, 500);
  }
});

// Get all vehicles
app.get("/make-server-e4206deb/vehicles", async (c) => {
  try {
    console.log('=== GET VEHICLES REQUEST ===');
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      console.log(`Authorization error: ${authResult.error}`);
      return c.json({ error: authResult.error }, authResult.status);
    }

    console.log('Fetching vehicles from KV store...');
    const supabase = getAdminClient();
    
    // 1. Fetch vehicles
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", "vehicle:%");

    if (vehiclesError) {
      console.log('Error fetching vehicles:', vehiclesError);
      throw new Error(`Database error fetching vehicles: ${vehiclesError.message}`);
    }
    
    const allVehicles = vehiclesData?.map(d => d.value) ?? [];
    
    const vehicles = allVehicles
      .filter(item => item && typeof item === 'object' && 'plate' in item);

    // 2. Fetch all trips to determine availability
    // Note: In a production scale app, we should maintain a separate "vehicle_status" index
    // instead of scanning all trips. For this MVP, scanning is acceptable.
    const { data: tripsData, error: tripsError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", "trip:%");

    if (tripsError) {
      console.log('Error fetching trips for availability check:', tripsError);
      // We continue with vehicles but they might be marked available incorrectly if this fails.
      // Ideally we should throw, but let's return vehicles as is to avoid blocking the UI completely.
    }

    const allTrips = tripsData?.map(r => r.value) || [];
    
    // Group trips by vehicle plate to find the LATEST status
    const vehicleTripsMap = new Map();
    
    allTrips.forEach((trip: any) => {
      if (!trip || !trip.vehiclePlate) return;
      
      if (!vehicleTripsMap.has(trip.vehiclePlate)) {
        vehicleTripsMap.set(trip.vehiclePlate, []);
      }
      vehicleTripsMap.get(trip.vehiclePlate).push(trip);
    });

    // Determine active trip for each vehicle based ONLY on the most recent trip
    const activeTripMap = new Map();
    
    for (const [plate, trips] of vehicleTripsMap.entries()) {
      // Sort trips by creation date (newest first)
      // Robust sort handling missing dates and ensuring stable sort for NaN
      const sortedTrips = (trips as any[]).sort((a: any, b: any) => {
        const getTimestamp = (trip: any) => {
             // Prefer createdAt
             if (trip.createdAt) {
                 const t = new Date(trip.createdAt).getTime();
                 return isNaN(t) ? 0 : t;
             }
             // Fallback to timeStart only if it contains full date (which it usually doesn't in this app),
             // so we default to 0 for legacy data to push it to the bottom.
             return 0;
        };
        
        const timeA = getTimestamp(a);
        const timeB = getTimestamp(b);
        
        if (timeA !== timeB) {
            return timeB - timeA;
        }
        
        // Tie-breaker: If created at exact same time (duplicate submission or quick retry),
        // Prefer the COMPLETED one as the "latest" to ensure vehicle is freed.
        if (a.status === 'completed' && b.status !== 'completed') return -1; // a comes first (completed)
        if (b.status === 'completed' && a.status !== 'completed') return 1;  // b comes first (completed)
        
        return 0;
      });
      
      const latestTrip = sortedTrips[0];
      
      // A vehicle is only unavailable if its VERY LAST trip is still in progress.
      if (latestTrip && latestTrip.status === 'in_progress') {
        activeTripMap.set(plate, latestTrip);
      }
    }
    
    // 3. Attach availability info
    const vehiclesWithStatus = vehicles.map((v: any) => ({
      ...v,
      isAvailable: !activeTripMap.has(v.plate),
      activeTrip: activeTripMap.get(v.plate) || null
    }));

    console.log(`Found ${vehicles.length} vehicles, ${activeTripMap.size} active trips`);
    return c.json({ vehicles: vehiclesWithStatus });
  } catch (error) {
    console.log(`Error fetching vehicles: ${error}`);
    return c.json({ error: "Erro interno ao buscar veículos" }, 500);
  }
});

// Get all vehicles (admin only) - same endpoint with admin path
app.get("/make-server-e4206deb/admin/vehicles", async (c) => {
  try {
    console.log('=== GET ADMIN VEHICLES REQUEST ===');
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      console.log(`Authorization error: ${authResult.error}`);
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;
    console.log(`User ${user.id} with role ${user.user_metadata?.role} is fetching vehicles`);

    const supabase = getAdminClient();

    // 1. Fetch vehicles
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", "vehicle:%");

    if (vehiclesError) {
      console.log('Error fetching vehicles from KV:', vehiclesError);
      throw new Error(`Database error fetching vehicles: ${vehiclesError.message}`);
    }

    const allVehicles = vehiclesData?.map(d => d.value) ?? [];

    console.log(`Total vehicle entries found: ${allVehicles.length}`);
    
    const vehicles = allVehicles
      .filter(item => item && typeof item === 'object' && 'plate' in item);

    console.log(`Filtered vehicles count: ${vehicles.length}`);
    return c.json({ vehicles });
  } catch (error) {
    console.log(`Error fetching vehicles: ${error}`);
    return c.json({ error: "Erro interno ao buscar veículos" }, 500);
  }
});

// Delete vehicle (admin only)
app.delete("/make-server-e4206deb/vehicles/:plate", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;

    // Check if user is admin
    if (user.user_metadata?.role !== 'admin' && user.user_metadata?.role !== 'super_admin') {
      return c.json({ error: 'Acesso negado - Requer acesso de administrador' }, 403);
    }

    const plate = c.req.param('plate');
    const supabase = getAdminClient();
    
    // Check if vehicle exists
    const { data: existingData, error: getError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", `vehicle:${plate}`);

    if (getError) {
      throw new Error(`Database error fetching vehicle: ${getError.message}`);
    }

    if (!existingData || existingData.length === 0) {
      return c.json({ error: "Veículo não encontrado" }, 404);
    }

    // Delete vehicle
    const { error: delError } = await supabase
      .from("kv_store_e4206deb")
      .delete()
      .eq("key", `vehicle:${plate}`);

    if (delError) {
      throw new Error(`Database error deleting vehicle: ${delError.message}`);
    }
    
    // Delete maintenance info
    await supabase
      .from("kv_store_e4206deb")
      .delete()
      .eq("key", `vehicle:${plate}:last_oil_change`);

    return c.json({ success: true, message: "Veículo excluído" });
  } catch (error: any) {
    console.log(`Error deleting vehicle: ${error}`);
    console.log('Stack:', error.stack);
    return c.json({ error: `Erro interno ao excluir veículo: ${error.message}` }, 500);
  }
});

// Update Vehicle Fuel Level (Drivers and Admins)
app.post("/make-server-e4206deb/vehicles/:plate/fuel", async (c) => {
  try {
    const authResult = await validateUser(c);
    if (authResult.error) return c.json({ error: authResult.error }, authResult.status);
    
    const user = authResult.user!;
    const plate = c.req.param('plate');
    const body = await c.req.json();
    const { level } = body;

    if (typeof level !== 'number' || level < 0 || level > 100) {
      return c.json({ error: "Nível de combustível deve ser um número entre 0 e 100" }, 400);
    }

    const supabase = getAdminClient();
    
    // Get existing vehicle
    const { data: existingData, error: getError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", `vehicle:${plate}`);

    if (getError || !existingData || existingData.length === 0) {
      return c.json({ error: "Veículo não encontrado" }, 404);
    }

    const vehicle = existingData[0].value;
    
    // Update fuel level
    const updatedVehicle = {
      ...vehicle,
      fuelLevel: level,
      lastFuelUpdate: new Date().toISOString(),
      lastFuelUpdateBy: user.user_metadata?.name || user.email
    };

    const { error: updateError } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: `vehicle:${plate}`,
        value: updatedVehicle
      });

    if (updateError) throw updateError;

    return c.json({ success: true, vehicle: updatedVehicle });
  } catch (error: any) {
    console.log(`Error updating fuel: ${error}`);
    return c.json({ error: "Erro ao atualizar combustível" }, 500);
  }
});

// Get vehicle last trip info (odometer)
app.get("/make-server-e4206deb/vehicles/:plate/last-trip", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }

    const plate = c.req.param('plate');
    const supabase = getAdminClient();
    
    // Fetch all trips to find the last one for this vehicle
    // Ideally we should use a secondary index or filter, but for KV we do this manually
    const { data: tripsData, error: tripsError } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .like("key", "trip:%");

    if (tripsError) {
      throw new Error(`Database error fetching trips: ${tripsError.message}`);
    }

    const allTrips = tripsData?.map(r => r.value) || [];
    
    // Filter for this vehicle and completed status
    const vehicleTrips = allTrips
      .filter((trip: any) => trip.vehiclePlate === plate && trip.status === 'completed');

    if (vehicleTrips.length === 0) {
      return c.json({ lastOdometer: null });
    }

    // Sort by completion time descending (or kmEnd descending as backup)
    vehicleTrips.sort((a: any, b: any) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return timeB - timeA;
    });

    const lastTrip = vehicleTrips[0];
    
    return c.json({ 
      lastOdometer: lastTrip.kmEnd,
      lastTripId: lastTrip.id,
      completedAt: lastTrip.completedAt
    });
  } catch (error) {
    console.log(`Error fetching last trip info: ${error}`);
    return c.json({ error: "Erro interno ao buscar última viagem" }, 500);
  }
});

// Get all users (admin only)
app.get("/make-server-e4206deb/admin/users", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;

    // Check if user is admin or super_admin
    if (user.user_metadata?.role !== 'admin' && user.user_metadata?.role !== 'super_admin') {
      return c.json({ error: 'Acesso negado - Requer acesso de administrador' }, 403);
    }

    const supabase = getAdminClient();
    
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (error) {
      throw new Error(`Database error fetching users: ${error.message}`);
    }

    const sanitizedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.user_metadata?.role || 'driver', // Default to driver if role missing
      name: u.user_metadata?.name || 'Unknown',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at
    }));

    return c.json({ users: sanitizedUsers });
  } catch (error) {
    console.log(`Error fetching users: ${error}`);
    return c.json({ error: "Erro interno ao buscar usuários" }, 500);
  }
});

// Get admin registration setting
app.get("/make-server-e4206deb/settings/admin-registration", async (c) => {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("kv_store_e4206deb")
      .select("value")
      .eq("key", "settings:admin_registration_enabled");
      
    // Default to false (disabled) if not set
    const isEnabled = data?.[0]?.value ?? false;
    
    return c.json({ enabled: isEnabled });
  } catch (error) {
    console.log(`Error fetching admin registration setting: ${error}`);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Update admin registration setting (Admin only)
app.put("/make-server-e4206deb/settings/admin-registration", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const user = authResult.user!;
    if (user.user_metadata?.role !== 'admin' && user.user_metadata?.role !== 'super_admin') {
      return c.json({ error: 'Acesso negado - Requer acesso de administrador' }, 403);
    }

    const body = await c.req.json();
    const { enabled } = body;
    
    if (typeof enabled !== 'boolean') {
        return c.json({ error: "O campo 'enabled' deve ser booleano" }, 400);
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from("kv_store_e4206deb")
      .upsert({
        key: "settings:admin_registration_enabled",
        value: enabled
      });

    if (error) {
      throw new Error(`Database error saving setting: ${error.message}`);
    }

    return c.json({ success: true, enabled });
  } catch (error) {
    console.log(`Error updating admin registration setting: ${error}`);
    return c.json({ error: "Erro interno do servidor" }, 500);
  }
});

// Delete user (Admin/Super Admin only)
app.delete("/make-server-e4206deb/admin/users/:id", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const requester = authResult.user!;
    const requesterRole = requester.user_metadata?.role;

    if (requesterRole !== 'admin' && requesterRole !== 'super_admin') {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    const targetUserId = c.req.param('id');
    const supabase = getAdminClient();

    // Prevent self-deletion
    if (requester.id === targetUserId) {
      return c.json({ error: "Você não pode excluir sua própria conta" }, 400);
    }

    // Get target user to check role
    const { data: { user: targetUser }, error: fetchError } = await supabase.auth.admin.getUserById(targetUserId);

    if (fetchError || !targetUser) {
      return c.json({ error: "Usuário não encontrado" }, 404);
    }

    const targetRole = targetUser.user_metadata?.role;

    // Hierarchy Logic
    // Super Admin: Can delete Admin and Driver
    // Admin: Can delete Driver ONLY
    
    if (requesterRole === 'admin') {
      if (targetRole === 'admin' || targetRole === 'super_admin') {
        return c.json({ error: "Administradores só podem excluir motoristas" }, 403);
      }
    }
    
    // Super Admin can delete anyone (except self, handled above)

    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      throw new Error(`Database error deleting user: ${deleteError.message}`);
    }

    return c.json({ success: true, message: "Usuário excluído com sucesso" });
  } catch (error) {
    console.log(`Error deleting user: ${error}`);
    return c.json({ error: "Erro interno ao excluir usuário" }, 500);
  }
});

// Update user role (Super Admin only or "Bootstrap" mechanism)
app.put("/make-server-e4206deb/admin/users/:id/role", async (c) => {
  try {
    const authResult = await validateUser(c);
    
    if (authResult.error) {
      return c.json({ error: authResult.error }, authResult.status);
    }
    
    const requester = authResult.user!;
    const targetUserId = c.req.param('id');
    const body = await c.req.json();
    const { role } = body;

    if (!['admin', 'driver', 'super_admin'].includes(role)) {
      return c.json({ error: "Função inválida" }, 400);
    }

    const supabase = getAdminClient();

    // Check if requester is super_admin
    const requesterRole = requester.user_metadata?.role;

    // BOOTSTRAP MECHANISM:
    // If the requester wants to promote THEMSELVES to super_admin,
    // allow it ONLY if there are NO EXISTING super_admins in the system.
    if (requester.id === targetUserId && role === 'super_admin') {
       const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
       if (listError) throw listError;
       
       const existingSuperAdmins = users.filter((u: any) => u.user_metadata?.role === 'super_admin');
       
       if (existingSuperAdmins.length === 0) {
         console.log(`Bootstrapping first Super Admin: ${requester.email}`);
         // Allow!
       } else {
         // If super admins exist, and you are not one of them, deny.
         if (requesterRole !== 'super_admin') {
           return c.json({ error: "Já existe um Super Admin no sistema. Solicite a alteração a ele." }, 403);
         }
       }
    } else {
      // Standard rule: Only Super Admin can change roles of others
      if (requesterRole !== 'super_admin') {
         return c.json({ error: "Apenas Super Administradores podem alterar funções de usuários" }, 403);
      }
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { user_metadata: { role } }
    );

    if (updateError) {
      throw new Error(`Error updating user role: ${updateError.message}`);
    }

    return c.json({ success: true, message: `Usuário atualizado para ${role}` });
  } catch (error) {
    console.log(`Error updating user role: ${error}`);
    return c.json({ error: "Erro interno ao atualizar função" }, 500);
  }
});

Deno.serve(app.fetch);