CREATE SCHEMA IF NOT EXISTS petrol;

CREATE TABLE IF NOT EXISTS petrol.provincias (
  id smallint PRIMARY KEY,
  nombre text NOT NULL
);

CREATE TABLE IF NOT EXISTS petrol.gasolineras (
  ideess text PRIMARY KEY,
  rotulo text,
  direccion text,
  localidad text,
  provincia_id smallint NOT NULL REFERENCES petrol.provincias(id),
  codigo_postal text,
  horario text,
  latitud numeric(10,6),
  longitud numeric(10,6),
  margen text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gasolineras_provincia ON petrol.gasolineras(provincia_id);

CREATE TABLE IF NOT EXISTS petrol.precios_historicos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gasolinera_id text NOT NULL REFERENCES petrol.gasolineras(ideess),
  fecha date NOT NULL,
  carburante text NOT NULL,
  precio numeric(6,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gasolinera_id, fecha, carburante)
);

CREATE INDEX IF NOT EXISTS idx_precios_historicos_gasolinera ON petrol.precios_historicos(gasolinera_id);
CREATE INDEX IF NOT EXISTS idx_precios_historicos_fecha ON petrol.precios_historicos(fecha);
CREATE INDEX IF NOT EXISTS idx_precios_historicos_carburante ON petrol.precios_historicos(carburante);

ALTER TABLE petrol.precios_historicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE petrol.gasolineras ENABLE ROW LEVEL SECURITY;
ALTER TABLE petrol.provincias ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_sel_prov ON petrol.provincias FOR SELECT USING (true);
CREATE POLICY p_ins_prov ON petrol.provincias FOR INSERT WITH CHECK (true);
CREATE POLICY p_upd_prov ON petrol.provincias FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY p_sel_gaso ON petrol.gasolineras FOR SELECT USING (true);
CREATE POLICY p_ins_gaso ON petrol.gasolineras FOR INSERT WITH CHECK (true);
CREATE POLICY p_upd_gaso ON petrol.gasolineras FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY p_sel_hist ON petrol.precios_historicos FOR SELECT USING (true);
CREATE POLICY p_ins_hist ON petrol.precios_historicos FOR INSERT WITH CHECK (true);
CREATE POLICY p_upd_hist ON petrol.precios_historicos FOR UPDATE USING (true) WITH CHECK (true);

GRANT USAGE ON SCHEMA petrol TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA petrol TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA petrol TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA petrol TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA petrol GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA petrol GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA petrol GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
