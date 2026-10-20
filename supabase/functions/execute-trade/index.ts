
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      const missing = [
        !supabaseUrl && "SUPABASE_URL",
        !anonKey && "SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY",
        !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
      ].filter(Boolean);
      console.error("Required Supabase environment variables are missing:", missing);
      return jsonResponse({
        error: {
          code: "SERVER_CONFIGURATION_ERROR",
          message: `Edge Function configuration is missing: ${missing.join(", ")}.`,
        },
      }, 503);
    }

    // Authenticate the caller using their Supabase access token.
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const accessToken = authHeader.slice("Bearer ".length);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonResponse({ error: "Invalid or expired session" }, 401);
    }

    // Accept only the trade inputs. Never accept a price or user ID
    // from the browser as authoritative.
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: { code: "INVALID_REQUEST", message: "Request body must be a JSON object." } }, 400);
    }
    const symbol =
      typeof body.symbol === "string"
        ? body.symbol.trim().toUpperCase()
        : "";
    const side =
      typeof body.side === "string"
        ? body.side.trim().toUpperCase()
        : "";
    const quantity = body.quantity;

    if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(symbol)) {
      return jsonResponse({ error: { code: "INVALID_SYMBOL", message: "Invalid stock symbol." } }, 400);
    }

    if (side !== "BUY" && side !== "SELL") {
      return jsonResponse({ error: { code: "INVALID_SIDE", message: "Side must be BUY or SELL." } }, 400);
    }

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1_000_000_000
    ) {
      return jsonResponse({ error: { code: "INVALID_QUANTITY", message: "Quantity must be a positive number." } }, 400);
    }

    // stock-price accepts POST JSON (not GET query parameters). The client cannot
    // override this server-fetched execution price.
    const quoteResponse = await fetch(
      `${supabaseUrl}/functions/v1/stock-price`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbol }),
      },
    );

    let quoteData: Record<string, unknown>;
    try {
      quoteData = await quoteResponse.json();
    } catch {
      console.error("stock-price returned a non-JSON response:", quoteResponse.status);
      return jsonResponse({ error: { code: "QUOTE_INVALID_RESPONSE", message: "Market quote service returned an invalid response." } }, 502);
    }

    if (!quoteResponse.ok) {
      console.error("Quote request failed:", quoteResponse.status);
      return jsonResponse(
        {
          error: {
            code: "QUOTE_REQUEST_FAILED",
            message:
            typeof quoteData.error === "string"
              ? quoteData.error
              : quoteData.error && typeof quoteData.error === "object" &&
                  "message" in quoteData.error && typeof quoteData.error.message === "string"
                ? quoteData.error.message
                : "Unable to retrieve a stock price",
          },
        },
        502,
      );
    }

    const price = quoteData.price;

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return jsonResponse({ error: { code: "INVALID_QUOTE", message: "Market quote service returned an invalid price." } }, 502);
    }

    if (quoteData.stale === true) {
      return jsonResponse({ error: { code: "STALE_QUOTE", message: "The latest market quote is stale; the trade was not placed." } }, 409);
    }

    // Only trusted server-side code uses the service-role key.
    // The user ID comes from the verified session, not the request body.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await adminClient.rpc("execute_trade", {
      p_user_id: user.id,
      p_symbol: symbol,
      p_side: side,
      p_quantity: quantity,
      p_price: price,
    });

    if (error) {
      console.error("Trade execution failed:", { code: error.code, message: error.message, details: error.details, hint: error.hint });

      if (error.code === "PGRST202" || error.code === "42883") {
        return jsonResponse({ error: { code: "TRADE_RPC_NOT_INSTALLED", message: "The database trade function is missing or has an outdated signature. Apply supabase/migrations/001_initial_schema.sql (including execute_trade with p_user_id), then retry." } }, 503);
      }
      if (error.code === "42501") {
        return jsonResponse({ error: { code: "TRADE_RPC_PERMISSION", message: "The server database role cannot execute the trade function. Reapply the function grants from the migration." } }, 503);
      }

      // Return a safe error rather than exposing database internals.
      const message = error.message.toLowerCase();

      if (
        message.includes("insufficient cash") ||
        message.includes("insufficient shares")
      ) {
        return jsonResponse({ error: { code: "TRADE_REJECTED", message: error.message } }, 400);
      }

      if (
        message.includes("invalid") ||
        message.includes("must be") ||
        message.includes("greater than zero")
      ) {
        return jsonResponse({ error: { code: "INVALID_TRADE", message: error.message } }, 400);
      }

      return jsonResponse({ error: { code: "TRADE_DATABASE_ERROR", message: "Database rejected the trade. Check the Edge Function logs for the database error code." } }, 503);
    }

    return jsonResponse({
      success: true,
      trade: data,
      quote: {
        symbol,
        price,
        price_time: quoteData.price_time ?? null,
        fetched_at: quoteData.fetched_at ?? null,
        source: quoteData.source ?? "Alpha Vantage",
      },
    });
  } catch (error) {
    console.error("execute-trade error:", error);
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } }, 400);
    }
    return jsonResponse({ error: { code: "TRADE_SERVICE_ERROR", message: "Trade service failed before completing the trade. Check the Edge Function logs." } }, 502);
  }
});
