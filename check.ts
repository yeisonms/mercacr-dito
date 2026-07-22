import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const parsed = Object.fromEntries(env.split("\n").filter(l => l.trim().length > 0).map(l => l.trim().split("=")));
const SUPABASE_URL = parsed.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = parsed.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const { data: cliente } = await supabase
    .from("clientes")
    .select("ruta_id, codigo_consecutivo, estado")
    .eq("codigo_consecutivo", "CLI-00033")
    .single();
    
  console.log("Cliente:", cliente);

  if (cliente?.ruta_id) {
    const { data: ruta } = await supabase
      .from("rutas")
      .select("*")
      .eq("id", cliente.ruta_id)
      .single();
    console.log("Ruta asignada:", ruta);
  }

  const { data: rutas } = await supabase.from("rutas").select("*");
  console.log("Todas las rutas IDs:", rutas?.map(r => ({ id: r.id, nombre: r.nombre_ruta, estado: r.estado })));
}

run();
