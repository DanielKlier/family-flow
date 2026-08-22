CREATE TABLE scenarios (
  id text PRIMARY KEY,
  name text NOT NULL,
  start_month text NOT NULL,
  end_month text NOT NULL,
  starting_buffer_cents integer NOT NULL,
  base_income_cents integer NOT NULL,
  baseline_mode text NOT NULL,
  baseline_window_length integer,
  baseline_expense_cents integer NOT NULL
);

CREATE TABLE scenario_adjustments (
  id text PRIMARY KEY,
  scenario_id text NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  delta_cents integer NOT NULL,
  start_month text NOT NULL,
  end_month text NOT NULL
);

CREATE INDEX scenario_adjustments_scenario_idx ON scenario_adjustments(scenario_id, id);
