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

export type SimilarCarMatch = {
  variant: VariantSpec;
  configuration: CarConfiguration;
  similarity: number;
};

const BASE_MODELS: BaseModelSpec[] = Object.entries(baseModelsData).map(([name, spec]) => ({
  name,
  brand: spec.brand,
  basePrice: spec.base_price,
  options: spec.options as BaseModelOptionMap,
}));

const VARIANTS: VariantSpec[] = (Array.isArray(variantsData) ? variantsData : []).flatMap(
  (entry, index) => {
    const nestedVariants = (entry as { variants?: unknown }).variants;
    if (Array.isArray(nestedVariants)) {
      return nestedVariants.map((variant, variantIndex) => ({
        model: (entry as Record<string, string>).model ?? (variant as Record<string, string>).model,
        brand: (entry as Record<string, string>).brand ?? (variant as Record<string, string>).brand,
        variantName:
          (variant as Record<string, string>).variant_name ??
          (variant as Record<string, string>).variantName ??
          `Variant ${variantIndex + 1}`,
        selections: variant as Partial<Record<string, string>>,
      }));
    }

    const variant = entry as Record<string, string>;
    const generatedName = [variant.transmission_type, variant.exterior_color, variant.roof_type]
      .filter((part) => Boolean(part))
      .join(" / ");
    const derivedName =
      variant.variant_name ?? variant.variantName ?? (generatedName || `Variant ${index + 1}`);

    return [
      {
        model: variant.model,
        brand: variant.brand,
        variantName: derivedName,
        selections: variant,
      },
    ];
  }
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

function variantToConfiguration(variant: VariantSpec): CarConfiguration {
  const base = getBaseModel(variant.model);
  const selections: Record<string, string> = {};

  Object.keys(base.options).forEach((attribute) => {
    const variantChoice = variant.selections[attribute];
    const defaultChoice = Object.keys(base.options[attribute])[0];
    selections[attribute] = variantChoice ?? defaultChoice ?? "";
  });

  return {
    model: variant.model,
    brand: variant.brand,
    basePrice: base.basePrice,
    selections,
  };
}

export function calculateSimilarityPercentage(
  first: CarConfiguration,
  second: CarConfiguration
): number {
  if (!first || !second) return 0;
  if (first.model !== second.model || first.brand !== second.brand) return 0;

  const attributes = Array.from(
    new Set([...Object.keys(first.selections || {}), ...Object.keys(second.selections || {})])
  );
  if (attributes.length === 0) return 0;

  const matches = attributes.filter(
    (attribute) => (first.selections[attribute] ?? "") === (second.selections[attribute] ?? "")
  ).length;

  return Math.round((matches / attributes.length) * 100);
}

export function findSimilarCars(
  config: CarConfiguration,
  thresholdPercentage = 60
): SimilarCarMatch[] {
  if (!config) return [];
  const threshold = Math.min(100, Math.max(0, thresholdPercentage));

  return VARIANTS.filter(
    (variant) => variant.brand === config.brand && variant.model === config.model
  )
    .map((variant) => {
      const configuration = variantToConfiguration(variant);
      const similarity = calculateSimilarityPercentage(config, configuration);
      return { variant, configuration, similarity };
    })
    .filter((item) => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
