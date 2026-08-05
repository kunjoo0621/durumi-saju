"use client";

import { useRouter } from "next/navigation";
import {
  WealthResultBody,
  type ApiResponse,
  type WealthBlocks,
} from "../../WealthResultClient";

export default function ShareWealthClient({
  data,
  result,
}: {
  data: ApiResponse;
  result: WealthBlocks;
}) {
  const router = useRouter();
  return <WealthResultBody data={data} result={result} router={router} shareMode />;
}
