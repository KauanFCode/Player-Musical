package com.kauan.player

import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.documentfile.provider.DocumentFile
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

class FolderScannerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val executor = Executors.newSingleThreadExecutor()

    private val allowedExtensions = setOf(
        "mp3", "m4a", "wav", "aac", "flac", "ogg", "opus",
        "jpg", "jpeg", "png", "webp",
        "lrc", "txt"
    )

    override fun getName(): String = "FolderScanner"

    @ReactMethod
    fun takePersistablePermission(treeUriStr: String, promise: Promise) {
        try {
            val uri = Uri.parse(treeUriStr)
            reactApplicationContext.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
            promise.resolve(true)
        } catch (e: Exception) {
            // Some OEM file pickers may not support persistable flag; caller still tracks folder
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun releasePersistablePermission(treeUriStr: String, promise: Promise) {
        try {
            val uri = Uri.parse(treeUriStr)
            reactApplicationContext.contentResolver.releasePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun scanFolder(treeUriStr: String, promise: Promise) {
        executor.execute {
            try {
                val uri = Uri.parse(treeUriStr)
                val rootDoc = DocumentFile.fromTreeUri(reactApplicationContext, uri)
                if (rootDoc == null || !rootDoc.exists() || !rootDoc.canRead()) {
                    promise.reject("E_UNREADABLE", "Pasta indisponível ou sem permissão.")
                    return@execute
                }

                val filesArray = Arguments.createArray()
                collectFiles(rootDoc, rootDoc.name ?: "Pasta", filesArray, 0)

                val result = Arguments.createMap().apply {
                    putString("folderName", rootDoc.name ?: "Pasta de Músicas")
                    putArray("files", filesArray)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("E_SCAN", e.message ?: "Erro ao escanear pasta.")
            }
        }
    }

    private fun collectFiles(
        dir: DocumentFile,
        folderName: String,
        out: WritableArray,
        depth: Int
    ) {
        if (depth > 6) return
        val children = try {
            dir.listFiles()
        } catch (e: Exception) {
            return
        }
        for (child in children) {
            if (child.isDirectory) {
                collectFiles(child, child.name ?: folderName, out, depth + 1)
            } else if (child.isFile) {
                val name = child.name ?: continue
                val ext = name.substringAfterLast('.', "").lowercase()
                if (ext !in allowedExtensions) continue

                val map = Arguments.createMap().apply {
                    putString("uri", child.uri.toString())
                    putString("name", name)
                    putString("folderName", folderName)
                    putDouble("size", child.length().toDouble())
                    putDouble("lastModified", child.lastModified().toDouble())
                    putString("mimeType", child.type ?: "")
                }
                out.pushMap(map)
            }
        }
    }

    @ReactMethod
    fun readHeaderBase64(uriStr: String, maxBytes: Int, promise: Promise) {
        executor.execute {
            try {
                val cap = maxBytes.coerceIn(1024, 2_097_152)
                val uri = Uri.parse(uriStr)
                reactApplicationContext.contentResolver.openInputStream(uri)?.use { input ->
                    val chunk = ByteArray(16384)
                    val out = ByteArrayOutputStream()
                    var total = 0
                    while (total < cap) {
                        val toRead = minOf(chunk.size, cap - total)
                        val read = input.read(chunk, 0, toRead)
                        if (read <= 0) break
                        out.write(chunk, 0, read)
                        total += read
                    }
                    val encoded = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                    promise.resolve(encoded)
                } ?: promise.resolve(null)
            } catch (e: Exception) {
                promise.resolve(null)
            }
        }
    }

    @ReactMethod
    fun readTextUri(uriStr: String, promise: Promise) {
        executor.execute {
            try {
                val uri = Uri.parse(uriStr)
                reactApplicationContext.contentResolver.openInputStream(uri)?.use { input ->
                    val text = input.bufferedReader(Charsets.UTF_8).readText()
                    promise.resolve(text)
                } ?: promise.resolve("")
            } catch (e: Exception) {
                promise.resolve("")
            }
        }
    }
}
