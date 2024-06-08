import { getServerSession } from "next-auth";
import { connectDB } from "../connectDB";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Analysis from "@/models/analysisModel";

export default async function getAnalyses() {
  await connectDB();
  const session = await getServerSession(authOptions);
  const analyses = await Analysis.find({
    user: session?.user?.id,
  }).select("patient note ecg.sampling_frequency date updatedAt");

  return analyses;
}
