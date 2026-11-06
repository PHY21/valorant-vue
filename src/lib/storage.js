export function readSaved(raw) {
  try {
    const x = JSON.parse(raw) || {};
    return {
      favorites: Array.isArray(x.favorites)
        ? [...new Set(x.favorites.filter(Number.isInteger))]
        : [],
      comments: Array.isArray(x.comments)
        ? x.comments.filter(
            (c) =>
              c &&
              typeof c.id === "string" &&
              typeof c.target === "string" &&
              typeof c.name === "string" &&
              typeof c.text === "string" &&
              Number.isInteger(c.rating) &&
              c.rating >= 1 &&
              c.rating <= 5 &&
              typeof c.date === "string",
          )
        : [],
    };
  } catch {
    return { favorites: [], comments: [] };
  }
}
