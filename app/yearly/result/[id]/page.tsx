import YearlyResultClient from "./YearlyResultClient";

export default async function YearlyResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <YearlyResultClient resultId={id} />;
}
