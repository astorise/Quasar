export default {
  content: ["./index.html", "./src/**/*.js"],
  theme: {
    extend: {
      colors: {
        quasar: {
          void: "#101820",
          ink: "#172026",
          plasma: "#1f7a8c",
          aurora: "#49a078",
          frost: "#f4f7f8",
          orbit: "#d7e2df",
          warning: "#8f2d56",
        },
      },
      boxShadow: {
        telemetry: "0 18px 50px rgba(16, 24, 32, 0.08)",
      },
    },
  },
  plugins: [],
};
