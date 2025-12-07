import baseModelsData from "./base_models_10.json";
import variantsData from "./variants_10.json";

export type ConfigAttribute = string;

export type BaseModelOptionMap = Record<string, Record<string, number>>;

export type BaseModelSpec = {
  name: string;
  brand: string;
  basePrice: number;
  options: BaseModelOptionMap;
};

export type VariantSpec = {
  model: string;
  brand: string;
  variantName: string;
  selections: Partial<Record<string, string>>;
};

export type CarConfiguration = {
  model: string;
  brand: string;
  basePrice: number;
  selections: Record<string, string>;
};

export type PricingBreakdown = {
  basePrice: number;
  adjustments: { label: string; delta: number }[];
  total: number;
};

const BASE_MODELS: BaseModelSpec[] = Object.entries(baseModelsData).map(([name, spec]) => ({
  name,
  brand: spec.brand,
  basePrice: spec.base_price,
  options: spec.options as BaseModelOptionMap,
}));

const VARIANTS: VariantSpec[] = variantsData.flatMap((entry) =>
  entry.variants.map((variant) => ({
    model: entry.model,
    brand: entry.brand,
    variantName: variant.variant_name,
    selections: variant,
  }))
);

export const listBaseModels = () => BASE_MODELS;

export function getBaseModel(modelName?: string) {
  if (!modelName) return BASE_MODELS[0];
  return BASE_MODELS.find((m) => m.name === modelName) ?? BASE_MODELS[0];
}

export function getVariantsForModel(modelName: string) {
  return VARIANTS.filter((variant) => variant.model === modelName);
}

export function getOptionsForModel(modelName: string) {
  const model = getBaseModel(modelName);
  return Object.entries(model.options).map(([attribute, options]) => ({
    attribute: attribute as ConfigAttribute,
    options,
  }));
}

export function createConfigFromVariant(modelName: string, variantName?: string): CarConfiguration {
  const model = getBaseModel(modelName);
  const variant = variantName
    ? getVariantsForModel(modelName).find((v) => v.variantName === variantName)
    : undefined;

  const config: CarConfiguration = {
    model: model.name,
    brand: model.brand,
    basePrice: model.basePrice,
    selections: {},
  };

  Object.keys(model.options).forEach((attribute) => {
    const variantChoice = variant?.selections[attribute];
    const defaultChoice = Object.keys(model.options[attribute])[0];
    config.selections[attribute] = variantChoice ?? defaultChoice ?? "";
  });

  return config;
}

export function calculatePricing(config: CarConfiguration): PricingBreakdown {
  const model = getBaseModel(config.model);
  const adjustments: { label: string; delta: number }[] = [];

  Object.keys(model.options).forEach((attribute) => {
    const selected = config.selections[attribute];
    const delta = model.options[attribute][selected] ?? 0;
    if (delta !== 0) {
      adjustments.push({ label: `${attribute} -> ${selected}`, delta });
    }
  });

  const total = model.basePrice + adjustments.reduce((sum, item) => sum + item.delta, 0);

  return {
    basePrice: model.basePrice,
    adjustments,
    total,
  };
}
