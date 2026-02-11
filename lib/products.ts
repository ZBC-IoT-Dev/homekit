export interface Product {
  id: string;
  name: string;
  brand: string;
  image: string;
  description: string;
  features: string[];
}

export interface BackendDeviceType {
  key: string;
  name: string;
  brand: string;
  image: string;
  description: string;
  features: string[];
  enabled?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: "temp",
    name: "Præcis temperatursensor",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description:
      "Meget præcis overvågning af temperatur og luftfugtighed i ethvert rum.",
    features: [
      "±0,1°C nøjagtighed",
      "5 års batterilevetid",
      "Øjeblikkelige opdateringer",
    ],
  },
  {
    id: "humid",
    name: "AquaGuard luftfugtighedssensor",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description: "Hold dit hjem på det perfekte luftfugtighedsniveau.",
    features: [
      "Øjeblikkelige push-beskeder",
      "Lækagedetektion",
      "Historisk sporing",
    ],
  },
  {
    id: "climatesensor",
    name: "Klimasensor",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description:
      "Pålidelig overvågning af temperatur og luftfugtighed med opdateringer i realtid.",
    features: [
      "Temperaturovervågning",
      "Luftfugtighedsovervågning",
      "Realtidsdata",
    ],
  },
  {
    id: "power",
    name: "SmartPlug Pro",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description: "Styr dine apparater og overvåg strømforbruget i realtid.",
    features: ["Strømovervågning", "Stemmestyring", "Automatiske tidsplaner"],
  },
  {
    id: "onoffsensor",
    name: "PIR-bevægelsessensor",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description:
      "Pålidelig PIR-bevægelsesdetektering med statusopdateringer i næsten realtid.",
    features: [
      "Bevægelsesdetektering",
      "Hurtige opdateringer",
      "Klar til automatisering",
    ],
  },
  {
    id: "other",
    name: "Generisk IoT-enhed",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description:
      "En alsidig IoT-enhed til brugerdefinerede sensorer og aktuatorer.",
    features: ["Kan tilpasses", "Høj kompatibilitet", "Lav latenstid"],
  },
];

function humanizeDeviceType(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveBackendTypeName(item: BackendDeviceType): string {
  const normalizedKey = item.key.toLowerCase().trim();
  const normalizedName = item.name.toLowerCase().trim();

  if (!normalizedName || normalizedName === normalizedKey) {
    return humanizeDeviceType(item.key);
  }

  return item.name;
}

export function mapBackendDeviceTypes(
  backendDeviceTypes: BackendDeviceType[],
): Product[] {
  return backendDeviceTypes
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      id: item.key.toLowerCase().trim(),
      name: resolveBackendTypeName(item),
      brand: item.brand,
      image: item.image,
      description: item.description,
      features: item.features,
    }));
}

export function mergeProductsWithBackend(
  backendDeviceTypes?: BackendDeviceType[],
): Product[] {
  if (!backendDeviceTypes || backendDeviceTypes.length === 0) {
    return PRODUCTS;
  }

  const mergedById = new Map<string, Product>();

  for (const product of PRODUCTS) {
    mergedById.set(product.id, product);
  }

  for (const product of mapBackendDeviceTypes(backendDeviceTypes)) {
    mergedById.set(product.id, product);
  }

  if (!mergedById.has("other")) {
    const fallbackOther = PRODUCTS.find((p) => p.id === "other");
    if (fallbackOther) {
      mergedById.set("other", fallbackOther);
    }
  }

  return Array.from(mergedById.values());
}

export function getProduct(
  type: string,
  identifier?: string,
  sourceProducts: Product[] = PRODUCTS,
): Product {
  const normalizedType = type.toLowerCase().trim();
  const normalizedIdentifier = identifier?.toLowerCase().trim() || "";
  const normalizedTypeAliases = new Set([normalizedType]);

  if (normalizedType === "climate" || normalizedType === "climate_sensor") {
    normalizedTypeAliases.add("climatesensor");
  }

  // 1. Try exact ID match first (primary search)
  const exactMatch = sourceProducts.find(
    (p) =>
      normalizedTypeAliases.has(p.id) ||
      p.id === normalizedIdentifier ||
      (p.id === "climatesensor" &&
        (normalizedIdentifier.includes("climate") ||
          normalizedIdentifier.includes("temp"))),
  );
  if (exactMatch) return exactMatch;

  // 2. Try to find if type or identifier contains any of our known product IDs
  // We exclude 'other' from this search to avoid false positives
  const idMatch = sourceProducts.find(
    (p) =>
      p.id !== "other" &&
      (normalizedType.includes(p.id) || normalizedIdentifier.includes(p.id)),
  );
  if (idMatch) return idMatch;

  // 3. Fallback to name fragments matching in both type and identifier
  const nameMatch = sourceProducts.find(
    (p) =>
      p.id !== "other" &&
      (normalizedType.includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(normalizedType) ||
        normalizedIdentifier.includes(p.name.toLowerCase()) ||
        p.name.toLowerCase().includes(normalizedIdentifier)),
  );
  if (nameMatch) return nameMatch;

  // 4. Ultimate fallback to 'other'
  return (
    sourceProducts.find((p) => p.id === "other") ||
    sourceProducts[sourceProducts.length - 1] ||
    PRODUCTS[PRODUCTS.length - 1]
  );
}
