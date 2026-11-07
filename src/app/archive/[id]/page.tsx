import { OSWorkspace } from "@/components/os/workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OSWorkspace section="archive" id={id} />;
}
