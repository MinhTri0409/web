import Workspace from "../../components/workspace";

export const dynamic = "force-dynamic";

export default async function RoutePage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  return <Workspace path={`/${segments.join("/")}`} />;
}
