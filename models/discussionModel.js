const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  user: { type: String, required: true },
  text: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
}, { _id: true }); 

const commentSchema = new mongoose.Schema({
  user: { type: String, required: true },
  text: { type: String, required: true }, 
  created_at: { type: Date, default: Date.now },
  replies: [replySchema],
}, { _id: true }); 

const flaggedSchema = new mongoose.Schema({
  spam: { type: Number, default: 0 },
  harassment: { type: Number, default: 0 },
  other: { type: Number, default: 0 }
}, { _id: false });

const discussionSchema = new mongoose.Schema({
  user: { type: String, required: true },
  images: {
    type: [String],
    validate: {
      validator: arr => arr.length <= 4,
      message: props => `${props.path} field exceeds the limit of 4 images.`
    }
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  hashtags: { type: [String], default: [] },
  likes: { type: Number, default: 0 },
  comments: [commentSchema],
  isPinned: { type: Boolean, default: false },
  flagged_count: { type: flaggedSchema, default: () => ({ spam: 0, harassment: 0, other: 0 }) }, 
  flagged_status: { type: Boolean, default: false }
}, { timestamps: true });

discussionSchema.pre('save', function(next) {
  const totalFlags = (this.flagged_count.spam || 0) +
                     (this.flagged_count.harassment || 0) +
                     (this.flagged_count.other || 0);
  this.flagged_status = totalFlags > 5;
  next();
});

const Discussion = mongoose.model('Discussion', discussionSchema);
module.exports = Discussion;