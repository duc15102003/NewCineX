package com.cinex.common.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;

@Service
public class QrCodeService {

    /**
     * Sinh QR code PNG từ nội dung text.
     * VD: content = "CX-20260520-001" → QR code chứa booking code
     */
    public byte[] generateQrCode(String content, int size) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (WriterException | IOException e) {
            throw new RuntimeException("Failed to generate QR code", e);
        }
    }

    /**
     * Sinh QR code dạng Base64 — FE dùng: <img src="data:image/png;base64,..." />
     */
    public String generateQrCodeBase64(String content, int size) {
        byte[] qrBytes = generateQrCode(content, size);
        return Base64.getEncoder().encodeToString(qrBytes);
    }
}
