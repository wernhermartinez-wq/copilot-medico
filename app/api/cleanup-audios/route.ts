import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const manualHeader = request.headers.get("x-cron-secret");

  const isValidAuthRequest = CRON_SECRET && (
    authHeader === CRON_SECRET ||
    authHeader === `Bearer ${CRON_SECRET}`
  );
  const isValidManualRequest = CRON_SECRET && manualHeader === CRON_SECRET;

  if (!isValidAuthRequest && !isValidManualRequest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filesToDelete: string[] = [];

    const { data: folders, error: listError } = await supabaseAdmin
      .storage
      .from("audios-consultas")
      .list("", { sortBy: { column: "name", order: "asc" } });

    if (listError) {
      console.error("Error listing folders:", listError);
      throw listError;
    }

    if (!folders || folders.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "No folders to process",
      });
    }

    for (const folder of folders) {
      if (!folder.name || folder.name.startsWith(".")) continue;

      const { data: files, error: filesError } = await supabaseAdmin
        .storage
        .from("audios-consultas")
        .list(folder.name, { sortBy: { column: "created_at", order: "asc" } });

      if (filesError) {
        console.error(`Error listing files in folder ${folder.name}:`, filesError);
        continue;
      }

      if (!files || files.length === 0) continue;

      for (const file of files) {
        if (!file.created_at) continue;

        const fileDate = new Date(file.created_at);
        if (fileDate < sevenDaysAgo) {
          filesToDelete.push(`${folder.name}/${file.name}`);
        }
      }
    }

    if (filesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "No files to delete",
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .storage
      .from("audios-consultas")
      .remove(filesToDelete);

    if (deleteError) {
      console.error("Error deleting audio files:", deleteError);
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      deleted: filesToDelete.length,
      message: `Deleted ${filesToDelete.length} audio files older than 7 days`,
    });
  } catch (error: any) {
    console.error("Error in cleanup-audios:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}