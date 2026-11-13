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

type ForbiddenPageProps = {
  returnTo?: To;
  title?: string;
  description?: string;
  actionLabel?: string;
};

export function ForbiddenPage({
  returnTo = routes.home,
  title = "アクセス権限がありません",
  description = "このアカウントでは、このページを表示する権限がありません。",
  actionLabel = "ホームへ戻る",
}: ForbiddenPageProps = {}) {
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
          render={<Link to={returnTo} />}
          nativeButton={false}
          role="link"
        >
          {actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
