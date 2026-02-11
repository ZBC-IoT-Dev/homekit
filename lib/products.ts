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
    name: "Precision Temp Sensor",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60", // Placeholder until generation works
    description:
      "Highly accurate temperature and humidity monitoring for any room.",
    features: ["±0.1°C Accuracy", "5-Year Battery Life", "Instant Updates"],
  },
  {
    id: "humid",
    name: "AquaGuard Humidity Sensor",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description: "Keep your home at the perfect humidity level.",
    features: ["Instant Push Alerts", "Leak Detection", "Historical Tracking"],
  },
  {
    id: "power",
    name: "SmartPlug Pro",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description:
      "Control any appliance and monitor power consumption in real-time.",
    features: ["Power Monitoring", "Voice Control", "Schedule Automations"],
  },
  {
    id: "other",
    name: "Generic IoT Node",
    brand: "IoT HomeKit",
    image:
      "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?w=800&auto=format&fit=crop&q=60",
    description: "A versatile IoT node for custom sensors and actuators.",
    features: ["Customizable", "Highly Compatible", "Low Latency"],
  },
];

export function mapBackendDeviceTypes(
  backendDeviceTypes: BackendDeviceType[],
): Product[] {
  return backendDeviceTypes
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      id: item.key.toLowerCase().trim(),
      name: item.name,
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

  // 1. Try exact ID match first (primary search)
  const exactMatch = sourceProducts.find(
    (p) => p.id === normalizedType || p.id === normalizedIdentifier,
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
