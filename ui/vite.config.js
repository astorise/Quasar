export default {
  build: {
    rollupOptions: {
      treeshake: {
        moduleSideEffects: (id) => id.endsWith(".css") || id.includes("/src/components/") || id.includes("\\src\\components\\"),
        propertyReadSideEffects: false,
      },
    },
  },
};
