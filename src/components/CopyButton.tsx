import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { toBlob } from 'html-to-image';

interface CopyButtonProps {
  targetId: string;
  format: 'text' | 'html' | 'image';
  label?: string;
  className?: string;
}

export default function CopyButton({ targetId, format, label = "Copier", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const element = document.getElementById(targetId);
      if (!element) {
        toast.error("Élément introuvable.");
        return;
      }

      if (format === 'text') {
        const text = element.innerText;
        await navigator.clipboard.writeText(text);
      } else if (format === 'html') {
        const html = element.outerHTML;
        const text = element.innerText;
        const blobHtml = new Blob([html], { type: 'text/html' });
        const blobText = new Blob([text], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
          })
        ]);
      } else if (format === 'image') {
        const blob = await toBlob(element, { backgroundColor: '#ffffff' });
        if (blob) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
        } else {
          toast.error("Erreur lors de la capture de l'image.");
          return;
        }
      }

      setCopied(true);
      toast.success("Copié dans le presse-papier !");
      setTimeout(() => setCopied(false), 2000);
    } catch (err: any) {
      console.error(err);
      toast.error("Échec de la copie : " + err.message);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
        copied 
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
          : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 border border-slate-200 hover:text-indigo-700 hover:border-indigo-200'
      } ${className}`}
      title={label}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
