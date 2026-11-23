-- What a post Zumda sent carries above its words (owner's decision, November 2026: a collage or
-- a video with «Buyurtma berish»): 'photo' or 'video', its words a caption Zumda edits on a new
-- price. NULL: a text post, or one sent before (a photo then has `photo_file_id`). Additive.
ALTER TABLE source_links ADD COLUMN post_media TEXT CHECK (post_media IN ('photo', 'video'));
