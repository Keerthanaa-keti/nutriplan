-- Seed 4 system weekly plan templates with protein themes

INSERT INTO weekly_plan_templates (name, emoji, description, protein_theme, diet_type, is_system) VALUES
(
  'Egg + Paneer Week',
  '🥚+🧀',
  'Eggs every morning, paneer as lunch protein. Rotating grain base (roti/rice/millet) with dal and sabji. Light dinner with curd, fruit, peanut butter.',
  'egg_paneer',
  'egg',
  true
),
(
  'Egg + Chicken Week',
  '🥚+🍗',
  'Eggs every morning, chicken as lunch protein. Rotating grain base with dal and sabji. Light dinner with curd, fruit, peanut butter.',
  'egg_chicken',
  'non_veg',
  true
),
(
  'Egg + Sprouts Week',
  '🥚+🫘',
  'Eggs every morning, sprouts and lentils heavy lunch. More millet rotation. Light dinner with curd, fruit, peanut butter.',
  'egg_sprouts',
  'egg',
  true
),
(
  'Paneer + Lentils Week',
  '🧀+🫘',
  'No eggs. Paneer and heavy dal for protein. Millet-heavy grain rotation. Light dinner with curd, fruit, peanut butter.',
  'paneer_lentils',
  'veg',
  true
);
