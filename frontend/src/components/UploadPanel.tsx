"use client";

import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { analyzeFile, analyzeText } from "@/lib/api";

const ACCEPTED = [".pdf", ".docx", ".txt", ".md"];
const MAX_BYTES = 20 * 1024 * 1024;

interface Props {
  onJobStarted: (jobId: string, fileName: string) => void;
}

export function UploadPanel({ onJobStarted }: Props) {
  const [tab, setTab] = useState("file");
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) return `不支援的格式，請上傳 ${ACCEPTED.join(" / ")}`;
    if (file.size > MAX_BYTES) return "檔案超過 20MB 上限";
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) { setError(err); return; }
    setError(null);
    setSelectedFile(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmitFile = async () => {
    if (!selectedFile) return;
    setError(null);
    setLoading(true);
    try {
      const { job_id } = await analyzeFile(selectedFile);
      onJobStarted(job_id, selectedFile.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上傳失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitText = async () => {
    const trimmed = text.trim();
    if (!trimmed) { setError("請貼上合約文字"); return; }
    setError(null);
    setLoading(true);
    try {
      const { job_id } = await analyzeText(trimmed);
      onJobStarted(job_id, "貼上文字");
    } catch (e) {
      setError(e instanceof Error ? e.message : "送出失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="w-full mb-6 h-auto rounded-none border-b border-border p-0 gap-6">
          <TabsTrigger
            value="file"
            className="flex-none rounded-none px-0 pb-2.5 pt-1 text-sm tracking-wide"
          >
            上傳檔案
          </TabsTrigger>
          <TabsTrigger
            value="text"
            className="flex-none rounded-none px-0 pb-2.5 pt-1 text-sm tracking-wide"
          >
            貼上文字
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-0">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={[
              "relative flex flex-col items-center justify-center gap-3",
              "border rounded-sm bg-card px-8 py-14 cursor-pointer text-center",
              "transition-colors duration-150 select-none",
              dragging
                ? "border-foreground bg-secondary/60"
                : selectedFile
                  ? "border-risk-safe bg-risk-safe-bg/60"
                  : "border-border hover:border-foreground/40",
            ].join(" ")}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="sr-only"
              onChange={handleInputChange}
            />
            {selectedFile ? (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-risk-safe">
                  文件已收訖
                </p>
                <p className="font-serif text-base font-semibold text-foreground break-all">
                  {selectedFile.name}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {(selectedFile.size / 1024).toFixed(0)} KB · 點擊可更換
                </p>
              </>
            ) : (
              <>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  文件收件
                </p>
                <p className="font-serif text-lg font-semibold text-foreground">
                  送交合約文件
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  拖放或點擊上傳 · PDF / DOCX / TXT / MD · ≤ 20MB
                </p>
              </>
            )}
          </div>

          {error && tab === "file" && (
            <div className="mt-3 border border-risk-high bg-risk-high-bg rounded-sm px-3 py-2 text-sm text-risk-high">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] mr-2">錯誤</span>
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmitFile}
            disabled={!selectedFile || loading}
            className={`w-full mt-5 h-11 text-sm font-medium tracking-wide rounded-sm ${loading ? "" : "disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground"}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="cl-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                送出中...
              </span>
            ) : (
              "開始分析"
            )}
          </Button>
        </TabsContent>

        <TabsContent value="text" className="mt-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="在此貼上合約全文..."
            className={[
              "w-full min-h-[220px] rounded-sm border border-border bg-card",
              "px-4 py-3 text-sm leading-relaxed resize-y",
              "placeholder:text-muted-foreground focus:outline-none focus:border-foreground/60 focus:ring-1 focus:ring-foreground/20",
              "font-[PingFang_TC,Microsoft_JhengHei,system-ui,sans-serif]",
            ].join(" ")}
          />

          {error && tab === "text" && (
            <div className="mt-3 border border-risk-high bg-risk-high-bg rounded-sm px-3 py-2 text-sm text-risk-high">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] mr-2">錯誤</span>
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmitText}
            disabled={!text.trim() || loading}
            className={`w-full mt-5 h-11 text-sm font-medium tracking-wide rounded-sm ${loading ? "" : "disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground"}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="cl-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                送出中...
              </span>
            ) : (
              "開始分析"
            )}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
