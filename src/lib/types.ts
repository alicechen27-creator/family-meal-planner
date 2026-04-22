// ============================================================
// Enums / Unions
// ============================================================
export type UserRole = 'admin' | 'member'
export type RecipeType = 'split' | 'all_in_one'
export type ComponentType = 'starch' | 'meat' | 'vegetable' | 'sauce'
export type SelectionType = 'split' | 'all_in_one'
export type WeekPlanStatus = 'open' | 'closed'

// ============================================================
// Database row types
// ============================================================
export interface Profile {
  id: string
  display_name: string
  role: UserRole
  avatar_url: string | null
  created_at: string
}

export interface Recipe {
  id: string
  title: string
  description: string | null
  photo_url: string | null
  type: RecipeType
  servings: number
  source_url: string | null
  instructions: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RecipeComponent {
  id: string
  recipe_id: string
  type: ComponentType
  name: string
  display_order: number
  instructions: string | null
  recipe_component_ingredients?: RecipeComponentIngredient[]
}

export interface RecipeComponentIngredient {
  id: string
  component_id: string
  name: string
  amount: string | null
  unit: string | null
  channel: string | null
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  name: string
  amount: string | null
  unit: string | null
  channel: string | null
}

export interface IngredientCatalogEntry {
  id: string
  name: string
  default_channel: string | null
  is_staple: boolean
  created_at: string
}

export interface HomeInventoryItem {
  id: string
  ingredient_name: string
  quantity: string | null
  unit: string | null
  updated_at: string
  updated_by: string | null
}

export interface ShoppingChannel {
  id: string
  name: string
  sort_order: number
}

export interface WeekPlan {
  id: string
  week_start: string
  status: WeekPlanStatus
  created_by: string | null
  created_at: string
}

export interface MealSlot {
  id: string
  week_plan_id: string
  slot_date: string
  weekday: string
  is_available: boolean
}

export interface MealCombination {
  id: string
  starch_component_id: string | null
  meat_component_id: string | null
  veggie_component_id: string | null
  sauce_component_id: string | null
  times_eaten: number
  created_at: string
  starch_component?: RecipeComponent
  meat_component?: RecipeComponent
  veggie_component?: RecipeComponent
  sauce_component?: RecipeComponent
}

export interface CombinationRating {
  id: string
  combination_id: string
  meal_selection_id: string
  user_id: string
  rating: number
  comment: string | null
  rated_at: string
}

export interface RecipeRating {
  id: string
  recipe_id: string
  meal_selection_id: string
  user_id: string
  rating: number
  comment: string | null
  rated_at: string
}

export interface MealSelection {
  id: string
  meal_slot_id: string
  user_id: string
  selection_type: SelectionType
  starch_component_id: string | null
  meat_component_id: string | null
  veggie_component_id: string | null
  sauce_component_id: string | null
  recipe_id: string | null
  combination_id: string | null
  created_at: string
  profiles?: Profile
  starch_component?: RecipeComponent
  meat_component?: RecipeComponent
  veggie_component?: RecipeComponent
  sauce_component?: RecipeComponent
  recipe?: Recipe
  meal_combination?: MealCombination
}

export interface ShoppingListItem {
  id: string
  week_plan_id: string
  ingredient_name: string
  total_amount: string | null
  unit: string | null
  channel_name: string | null
  is_staple: boolean
  for_recipe_title: string | null
  for_date: string | null
  is_checked: boolean
}

// ============================================================
// Composite types for UI
// ============================================================
export interface RecipeWithComponents extends Recipe {
  recipe_components: RecipeComponent[]
  recipe_ingredients: RecipeIngredient[]
}

// meal_slot_id has a UNIQUE constraint, so PostgREST embeds meal_selections
// as a single object (or null), not an array.
export interface MealSlotWithSelection extends MealSlot {
  meal_selections: (MealSelection & {
    profiles: Profile
    starch_component: (RecipeComponent & { recipe_component_ingredients: RecipeComponentIngredient[] }) | null
    meat_component: (RecipeComponent & { recipe_component_ingredients: RecipeComponentIngredient[] }) | null
    veggie_component: (RecipeComponent & { recipe_component_ingredients: RecipeComponentIngredient[] }) | null
    sauce_component: (RecipeComponent & { recipe_component_ingredients: RecipeComponentIngredient[] }) | null
    recipe: (Recipe & { recipe_ingredients: RecipeIngredient[] }) | null
  }) | null
}

// ============================================================
// API / form types
// ============================================================
export interface ParsedIngredient {
  name: string
  amount: string
  unit: string
  channel?: string
}

export interface ParsedComponent {
  type: ComponentType
  name: string
  instructions?: string
  ingredients: ParsedIngredient[]
}

export interface ParsedRecipe {
  title: string
  description: string
  type: RecipeType
  servings: number
  source_url?: string
  instructions?: string
  components: ParsedComponent[]
  ingredients: ParsedIngredient[]
}

// ============================================================
// Constants
// ============================================================
export const WEEKDAYS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'] as const

export const COMPONENT_CONFIG: Record<ComponentType, {
  label: string
  color: string
  bg: string
  border: string
  emoji: string
}> = {
  starch:    { label: '澱粉／主食', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', emoji: '🍚' },
  meat:      { label: '肉',         color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   emoji: '🥩' },
  vegetable: { label: '蔬菜',       color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', emoji: '🥦' },
  sauce:     { label: '醬料',       color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200',emoji: '🫙' },
}

export const RECIPE_TYPE_CONFIG: Record<RecipeType, { label: string; emoji: string }> = {
  split:      { label: '分開組合', emoji: '🍱' },
  all_in_one: { label: '一鍋到底', emoji: '🥘' },
}
