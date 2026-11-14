import { routes } from "../shared/routes";
import { Link } from "react-router-dom";

export default function App() {
  return (
    <main className="p-6">
      <Link to={routes.home}>GAS BOOST</Link>
    </main>
  );
}
