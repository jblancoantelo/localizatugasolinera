CREATE TABLE IF NOT EXISTS provincias (
  id smallint PRIMARY KEY,
  nombre text NOT NULL
);

CREATE TABLE IF NOT EXISTS gasolineras (
  ideess text PRIMARY KEY,
  rotulo text,
  direccion text,
  localidad text,
  provincia_id smallint NOT NULL REFERENCES provincias(id),
  codigo_postal text,
  horario text,
  latitud numeric(10,6),
  longitud numeric(10,6),
  margen text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gasolineras_provincia ON gasolineras(provincia_id);

CREATE TABLE IF NOT EXISTS precios_historicos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gasolinera_id text NOT NULL REFERENCES gasolineras(ideess),
  fecha date NOT NULL,
  carburante text NOT NULL,
  precio numeric(6,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gasolinera_id, fecha, carburante)
);

CREATE INDEX IF NOT EXISTS idx_precios_historicos_gasolinera ON precios_historicos(gasolinera_id);
CREATE INDEX IF NOT EXISTS idx_precios_historicos_fecha ON precios_historicos(fecha);
CREATE INDEX IF NOT EXISTS idx_precios_historicos_carburante ON precios_historicos(carburante);

ALTER TABLE precios_historicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasolineras ENABLE ROW LEVEL SECURITY;
ALTER TABLE provincias ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_sel_prov ON provincias FOR SELECT USING (true);
CREATE POLICY p_sel_gaso ON gasolineras FOR SELECT USING (true);
CREATE POLICY p_sel_hist ON precios_historicos FOR SELECT USING (true);
CREATE POLICY p_ins_gaso ON gasolineras FOR INSERT WITH CHECK (true);
CREATE POLICY p_upd_gaso ON gasolineras FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY p_ins_hist ON precios_historicos FOR INSERT WITH CHECK (true);
CREATE POLICY p_upd_hist ON precios_historicos FOR UPDATE USING (true) WITH CHECK (true);
