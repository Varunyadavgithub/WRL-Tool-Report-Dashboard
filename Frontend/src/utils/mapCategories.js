export const CATEGORY_MAPPINGS = {
  COOLER: "Choc Cooler",
  "FOW MODELS": "FOW",
  "ICE LINED REFRIGERATOR": "Freezer",
  "COOLER AND FREEZER": "Freezer",
  "CHEST COOLER": "Freezer",
  MEDICAL: "Freezer",
  EUTECTIC: "Freezer",
  ILR: "Freezer",
  "VACCINE FREEZER": "Freezer",
  DUAL: "Freezer",
  "EUTECTIC FOW FREEZER": "Freezer",
  FREEZER: "Freezer",
  "2 GLASS DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "1 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "2 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "3 DOOR UNDERCOUNTER REFRIGERATOR": "SUS",
  "STORAGE WATER COOLER": "SWC",
  "VISI COOLER": "VISI COOLER",
};

// export const mapCategory = async (data, mappings = CATEGORY_MAPPINGS) => {
//   if (!data) return [];

//   const normalize = (str) => str.replace(/\s+/g, " ").trim().toUpperCase();

//   const dataArray = Array.isArray(data) ? data : [data];

//   return dataArray.map((item) => {
//     const mappedItem = { ...item };

//     if (mappedItem?.category) {
//       const normalizedCategory = normalize(mappedItem.category);
//       mappedItem.category =
//         mappings[normalizedCategory] || mappedItem.category.trim();
//     }

//     return mappedItem;
//   });
// };
