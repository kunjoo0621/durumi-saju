"use client";

import { useRouter } from "next/navigation";
import {
  CareerResultBody,
  type ApiResponse,
  type CareerBlocks,
} from "../../CareerResultClient";

export default function ShareCareerClient({
  data,
  result,
}: {
  data: ApiResponse;
  result: CareerBlocks;
}) {
  const router = useRouter();
  return <CareerResultBody data={data} result={result} router={router} shareMode />;
}
