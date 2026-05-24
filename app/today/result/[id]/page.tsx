import TodayResultClient from "./TodayResultClient";

export default async function TodayResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TodayResultClient resultId={id} />;
}
