-- Set shelf_life_days for common items in master_food_list
-- Used by Grocery Days feature to split orders between Monday (full week) and Thursday (fresh restock)

-- Short shelf life (1-3 days) - will appear on BOTH Monday and Thursday orders
UPDATE master_food_list SET shelf_life_days = 2 WHERE lower(name) LIKE '%milk%' AND category = 'dairy';
UPDATE master_food_list SET shelf_life_days = 3 WHERE lower(name) LIKE '%curd%' OR lower(name) LIKE '%yogurt%';
UPDATE master_food_list SET shelf_life_days = 3 WHERE lower(name) LIKE '%mixed vegetable%' OR lower(name) LIKE '%mixed veg%';
UPDATE master_food_list SET shelf_life_days = 3 WHERE lower(name) LIKE '%banana%';
UPDATE master_food_list SET shelf_life_days = 3 WHERE lower(name) LIKE '%dosa batter%';
UPDATE master_food_list SET shelf_life_days = 1 WHERE lower(name) LIKE '%roti%' OR lower(name) LIKE '%chapati%';

-- Medium shelf life (4-7 days) - Monday only
UPDATE master_food_list SET shelf_life_days = 7 WHERE lower(name) LIKE '%egg%' AND category = 'egg';
UPDATE master_food_list SET shelf_life_days = 5 WHERE lower(name) LIKE '%paneer%';
UPDATE master_food_list SET shelf_life_days = 5 WHERE lower(name) LIKE '%pomegranate%';

-- Long shelf life (NULL) - Monday only, pantry staples
UPDATE master_food_list SET shelf_life_days = NULL WHERE lower(name) LIKE '%rice%' AND category IN ('grain', 'staple');
UPDATE master_food_list SET shelf_life_days = NULL WHERE lower(name) LIKE '%dal%' OR lower(name) LIKE '%daal%';
UPDATE master_food_list SET shelf_life_days = NULL WHERE lower(name) LIKE '%cooking oil%' OR lower(name) LIKE '%oil%' AND category = 'oil';
UPDATE master_food_list SET shelf_life_days = NULL WHERE lower(name) LIKE '%peanut butter%';
UPDATE master_food_list SET shelf_life_days = NULL WHERE lower(name) LIKE '%mixed nuts%' OR lower(name) LIKE '%nuts%' AND category = 'nut_seed';
UPDATE master_food_list SET shelf_life_days = NULL WHERE lower(name) LIKE '%whey%' OR lower(name) LIKE '%protein%' AND category = 'protein_supplement';
