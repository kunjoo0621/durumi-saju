"use client";

import { useRouter } from "next/navigation";
import {
  MarriageResultBody,
  type ApiResponse,
  type MarriageBlocks,
} from "../../MarriageResultClient";

export default function ShareMarriageClient({
  data,
  result,
}: {
  data: ApiResponse;
  result: MarriageBlocks;
}) {
  const router = useRouter();
  return <MarriageResultBody data={data} result={result} router={router} shareMode />;
}
