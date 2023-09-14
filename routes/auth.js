const router = require('express').Router();
const User = require('../models/User');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const nodemailer = require("nodemailer");

const saltRounds = 10;

router.post('/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

        const token = crypto.randomBytes(16).toString("hex");

        const newUser = new User({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,  // ハッシュ化されたパスワードを保存
            confirmationToken: token,
            isVerified: false
        });

        await sendConfirmationEmail(req.body.email, token);

        const user = await newUser.save();
        return res.status(200).json({ message: "Confirmation email sent", user: user._id });
    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
});


router.post("/login", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        
        const token = jwt.sign(
            { userId: user._id },   // ペイロードにはユーザーIDなどの情報を持たせることができます
            'YOUR_SECRET_KEY',     // 秘密鍵（任意の文字列）です
            { expiresIn: '1h' }    // トークンの有効期限を設定します（例：1時間）
        );

        if (!user) return res.status(400).send("ユーザーが見つかりません");

        // bcrypt.compare を使ってハッシュ値を比較
        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) return res.status(400).json("パスワードが違います");

        return res.status(200).json(user);
    } catch (err) {
        res.status(500).json(err);
    }
});

router.get('/confirm-email/:token', async (req, res) => {
    try {
        const user = await User.findOne({ confirmationToken: req.params.token });
        if (!user) {
            return res.status(400).json({ message: "Invalid token" });
        }

        user.isVerified = true;
        user.confirmationToken = undefined;
        await user.save();

        res.status(200).json({ message: "Email認証済み" });
    } catch (err) {
        res.status(500).json(err);
    }
});


async function sendConfirmationEmail(email, token) {
    const transporter = nodemailer.createTransport({
        service: "Gmail",  // ここを使用しているメールサービスに変更してください
        auth: {
            user: "iput.kernel@gmail.com",
            pass: process.env.MAILPASS
        }
    });

    const link = `https://www.iput-kernel.com/api/auth/confirm-email/${token}`;

    const mailOptions = {
        from: "iput-kernel@gmail.com",
        to: email,
        subject: "アカウント登録",
        text: "このリンクをクリックすれば有効化されるよ: " + link
    };

    await transporter.sendMail(mailOptions);
}

module.exports = router;