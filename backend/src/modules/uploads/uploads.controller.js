export async function uploadSingleImage(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ message: 'file is required' });

    const url = `/uploads/${req.file.filename}`;

    res.status(201).json({
      url,
      filename: req.file.filename,
      size: req.file.size,
      mime: req.file.mimetype
    });
  } catch (e) {
    next(e);
  }
}
