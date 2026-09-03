# Archive policy

- `local_legacy/`: snapshot kode/config/docs dari sistem lokal lama.
- `github_legacy/`: file GitHub lama yang sudah digantikan setelah migrasi terverifikasi.
- Archive bersifat read-only reference.
- Jangan mengimpor engine dari folder archive.
- File data besar tidak masuk Git; simpan satu data root dan catat hash/provenance di `../manifests/`.
