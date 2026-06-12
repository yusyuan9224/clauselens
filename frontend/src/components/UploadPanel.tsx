"use client";

import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { analyzeFile, analyzeText } from "@/lib/api";
import { Upload, FileText, AlertCircle } from "lucide-react";

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
        <TabsList className="w-full mb-6 bg-secondary border border-border">
          <TabsTrigger value="file" className="flex-1 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Upload className="w-4 h-4" />
            上傳檔案
          </TabsTrigger>
          <TabsTrigger value="text" className="flex-1 gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4" />
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
              "relative flex flex-col items-center justify-center gap-4",
              "border-2 border-dashed rounded-xl p-12 cursor-pointer",
              "transition-all duration-150 select-none",
              dragging
                ? "border-[--cl-navy] bg-blue-50/60"
                : selectedFile
                  ? "border-green-400 bg-green-50/40"
                  : "border-border hover:border-[--cl-navy-light] hover:bg-secondary/60",
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
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / 1024).toFixed(0)} KB · 點擊可更換
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm text-foreground">拖放或點擊上傳</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    支援 PDF、DOCX、TXT、MD，最大 20MB
                  </p>
                </div>
              </>
            )}
          </div>

          {error && tab === "file" && (
            <div className="flex items-start gap-2 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleSubmitFile}
            disabled={!selectedFile || loading}
            className="w-full mt-4 bg-[--cl-navy] hover:bg-[--cl-navy-light] text-white h-11 text-sm font-medium"
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
              "w-full min-h-[220px] rounded-xl border border-border bg-white",
              "px-4 py-3 text-sm leading-relaxed resize-y",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[--cl-navy]/30 focus:border-[--cl-navy]",
              "font-[PingFang_TC,Microsoft_JhengHei,system-ui,sans-serif]",
            ].join(" ")}
          />

          {error && tab === "text" && (
            <div className="flex items-start gap-2 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            onClick={handleSubmitText}
            disabled={!text.trim() || loading}
            className="w-full mt-4 bg-[--cl-navy] hover:bg-[--cl-navy-light] text-white h-11 text-sm font-medium"
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
