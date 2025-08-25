const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: { type: String, required: true },
  comment_reply_messages: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const flaggedSchema = new mongoose.Schema({
  spam: { type: Number, default: 0 },
  harassment: { type: Number, default: 0 },
  other: { type: Number, default: 0 }
}, { _id: false });

const discussionSchema = new mongoose.Schema({
  user: { type: String, required: true },
  images: {
    type: [String],
    validate: [arr => arr.length <= 4, 'Maximum 4 images allowed']
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  comments: [commentSchema],
  flagged_count: { type: flaggedSchema, default: () => ({}) },
  flagged_status: { type: Boolean, default: false }
}, { timestamps: true });

// Update flagged_status before save
discussionSchema.pre('save', function(next) {
  const totalFlags = (this.flagged_count.spam || 0) +
                     (this.flagged_count.harassment || 0) +
                     (this.flagged_count.other || 0);
  this.flagged_status = totalFlags > 5;
  next();
});

const Discussion = mongoose.model('Discussion', discussionSchema);
module.exports = Discussion;
