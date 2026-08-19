"use client";

import React, { useState, useRef } from "react";
import { Button } from "@nextui-org/react";
import { HiPhoto } from "react-icons/hi2";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

type Props = {
  onUploadImage?: (result: any) => void;
};

export default function ImageUploadButton({ onUploadImage }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Photo uploaded successfully!");
        if (onUploadImage) {
          onUploadImage({
            info: {
              secure_url: data.url,
              public_id: data.publicId || data.photo?.publicId,
            },
          });
        }
        router.refresh();
      } else {
        toast.error(data.error || "Failed to upload photo");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <Button
        color="secondary"
        variant="bordered"
        isLoading={isUploading}
        onClick={() => fileInputRef.current?.click()}
        startContent={!isUploading && <HiPhoto size={24} className="text-pink-500" />}
        className="font-bold border-2 border-pink-400 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/40 rounded-xl"
      >
        {isUploading ? "Uploading Photo..." : "Upload New Photo"}
      </Button>
    </div>
  );
}
