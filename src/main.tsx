import { createRoot } from "react-dom/client";
import "./index.css";
const root = createRoot(document.getElementById("root")!);
void import("./App")
  .then(({ default: App }) => root.render(<App />))
  .catch((error) =>
    root.render(
      <main role="alert" style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Rebuild setup needs attention</h1>
        <p>{String(error.message)}</p>
        <p>The original app has not been connected or changed.</p>
      </main>,
    ),
  );
