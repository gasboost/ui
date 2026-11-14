import { AuthApp } from "./components/AuthApp";
import { RealtimeGuard } from "./components/RealtimeGuard";
import { client } from "./lib/auth-rpc";
const issueCustomToken = () => client.issueFirebaseCustomToken();
export default function App() {
  return (
    <AuthApp
      sessionElement={<RealtimeGuard issueCustomToken={issueCustomToken} />}
    />
  );
}
import "./lib/replica";
