import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

console.log("URL:", supabaseUrl)  // Pour déboguer
console.log("Key:", supabaseKey)  // Pour déboguer

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Variables d'environnement manquantes. Vérifiez votre fichier .env")
}

export const supabase = createClient(supabaseUrl, supabaseKey)