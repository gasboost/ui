import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link, type To } from "react-router-dom";
import { routes } from "../../shared/routes";

type UnauthorizedPageProps = {
  signInTo?: To;
  title?: string;
  description?: string;
  actionLabel?: string;
};

export function UnauthorizedPage({
  signInTo = routes.auth.signIn,
  title = "ログインが必要です",
  description = "このページを表示するにはログインしてください。",
  actionLabel = "ログインへ",
}: UnauthorizedPageProps = {}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          <h1>{title}</h1>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          render={<Link to={signInTo} />}
          nativeButton={false}
          role="link"
        >
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
