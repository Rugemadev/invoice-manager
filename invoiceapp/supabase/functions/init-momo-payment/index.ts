import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MOMO_ENV = Deno.env.get('MOMO_ENV') ?? 'sandbox'
const MOMO_BASE_URL = MOMO_ENV === 'sandbox'
  ? 'https://sandbox.momodeveloper.mtn.com'
  : 'https://proxy.momoapi.mtn.com'

async function getMoMoToken(subscriptionKey: string, apiUser: string, apiKey: string) {
  const credentials = btoa(`${apiUser}:${apiKey}`)
  const res = await fetch(`${MOMO_BASE_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
    body: '', // empty body forces Deno to send Content-Length: 0 (required by MTN)
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`MoMo token error ${res.status}: ${body}`)
  }
  const { access_token } = await res.json()
  return access_token as string
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) return '250' + digits.slice(1)
  if (digits.startsWith('25')) return digits
  return '250' + digits
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { amount, currency, phone, invoiceId, invoiceNumber } = await req.json()

    if (!amount || !phone || !invoiceId) {
      return new Response(JSON.stringify({ error: 'amount, phone, and invoiceId are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (typeof amount !== 'number' || amount <= 0 || amount > 10_000_000) {
      return new Response(JSON.stringify({ error: 'Invalid payment amount' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subscriptionKey = Deno.env.get('MOMO_SUBSCRIPTION_KEY') ?? ''
    const apiUser         = Deno.env.get('MOMO_API_USER') ?? ''
    const apiKey          = Deno.env.get('MOMO_API_KEY') ?? ''
    if (!subscriptionKey || !apiUser || !apiKey) throw new Error('MoMo credentials not configured')

    const token       = await getMoMoToken(subscriptionKey, apiUser, apiKey)
    const referenceId = crypto.randomUUID()

    const res = await fetch(`${MOMO_BASE_URL}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization':               `Bearer ${token}`,
        'X-Reference-Id':              referenceId,
        'X-Target-Environment':        MOMO_ENV,
        'Ocp-Apim-Subscription-Key':  subscriptionKey,
        'Content-Type':                'application/json',
      },
      body: JSON.stringify({
        amount:     String(Math.round(amount)),
        currency:   MOMO_ENV === 'sandbox' ? 'EUR' : (currency ?? 'RWF'),
        externalId: invoiceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId:     normalizePhone(phone),
        },
        payerMessage: `Payment for ${invoiceNumber ?? invoiceId}`,
        payeeNote:    `Invoice ${invoiceNumber ?? invoiceId}`,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`MoMo request failed ${res.status}: ${body}`)
    }

    return new Response(JSON.stringify({ referenceId, status: 'PENDING' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error'
    console.error('[init-momo-payment]', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
