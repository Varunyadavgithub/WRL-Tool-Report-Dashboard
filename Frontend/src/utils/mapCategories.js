const CATEGORY_MAPPINGS = {
  COOLER: "Choc Cooler",
  "FOW MODELS": "FOW",
  "Ice Lined Refrigerator": "Freezer",
  "COOLER AND FREEZER": "Freezer",
  "CHEST COOLER": "Freezer",
  MEDICAL: "Freezer",
  EUTECTIC: "Freezer",
  ILR: "Freezer",
  "VACCINE FREEZER": "Freezer",
  DUAL: "Freezer",
  "EUTECTIC FOW FREEZER": "Freezer",
  Freezer: "Freezer",
  "2 GLASS DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "1 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "2 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "3 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "Storage Water Cooler": "SWC",
  "VISI COOLER": "VISI COOLER",
};

export const mapCategory = async (data, mappings = CATEGORY_MAPPINGS) => {
  if (!data) return [];

  const dataArray = Array.isArray(data) ? data : [data];

  return dataArray.map((item) => {
    // Create a new object to avoid mutating the original
    const mappedItem = { ...item };

    // Map Category_Name if it exists
    if (mappedItem.Category_Name) {
      mappedItem.Category_Name =
        mappings[mappedItem.Category_Name.toUpperCase()] ||
        mappedItem.Category_Name;
    }
    return mappedItem;
  });
};
