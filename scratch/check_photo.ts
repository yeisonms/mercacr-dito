
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("codigo_consecutivo", "CLI-01905")
    .single();
  
  if (error) {
    console.error("Error fetching client:", error);
    return;
  }
  
  console.log("Client Data:");
  console.log("nombres:", data.nombres);
  console.log("apellidos:", data.apellidos);
  console.log("foto_cliente_url:", data.foto_cliente_url);
}

main();

