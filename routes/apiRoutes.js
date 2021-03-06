const db = require('../models');

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAILER_ADDRESS,
        pass: process.env.MAILER_PASSWORD
    }
});

module.exports = function (app) {
    const profileLink = "https://something--borrowed.herokuapp.com/profile";
    //https://developers.google.com/identity/sign-in/web/backend-auth
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_SIGN_IN);
    async function verify(token) {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_SIGN_IN
        });
        const payload = ticket.getPayload();
        const verifiedUserId = payload.sub;
        return verifiedUserId;
    }

    app.post('/api/login', async function (req, res) {
        const signIn = req.body;
        const userId = await verify(signIn.token).catch(console.error);
        const userInfo = {
            userIdToken: userId,
            userName: signIn.name,
            userEmail: signIn.email,
            userImage: signIn.image
        };
        const userIdCookie = req.cookies.userid;
        if (userIdCookie === userId) {
            res.send({ signedIn: true });
        } else {
            db.User.findAll({ where: { userIdToken: userId } }).then(function (pastUser) {
                if (pastUser.length > 0) {
                    res.cookie('userid', userId).send({ registeredUser: userId });
                } else {
                    db.User.create(userInfo).then(function () {
                        res.cookie('userid', userId).send({ newUser: userId });
                    });
                }
            });
        }
    });


    app.put('/api/login', function (req, res) {
        const updatedInfo = req.body;
        const userId = req.cookies.userid;
        db.User.update(updatedInfo, { where: { userIdToken: userId } }).then(function (dbUser) {
            if (dbUser.changedRows === 0) {
                return res.status(404).end();
            }
            res.status(204).end();
        });
    });

    app.post('/api/contact', function (req, res) {
        const contactData = req.body;
        const mailOptions = {
            from: process.env.MAILER_ADDRESS,
            to: process.env.MAILER_ADDRESS,
            subject: `Contact from ${contactData.contactName}`,
            text: `Contact Name: ${contactData.contactName}; Contact Phone: ${contactData.contactPhone}; Contact Email: ${contactData.contactEmail}; Contact Message: ${contactData.contactMessage};`,
            html: `<p>Contact Name: ${contactData.contactName}</p><p>Contact Phone: ${contactData.contactPhone}</p><p>Contact Email: ${contactData.contactEmail}</p><p>Contact Message: ${contactData.contactMessage}</p>`
        };
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                res.sendStatus(500);
            } else {
                console.log('Email sent: ' + info.response);
                res.sendStatus(200);
            }
        });
    });

    app.post('/api/items', function (req, res) {
        let item = req.body;
        console.log('POST to /api/items body: ' + JSON.stringify(req.body));
        let groupIds = req.body.groupsAvailable;
        let groupIdsInt;
        if (Array.isArray(groupIds)) { groupIdsInt = groupIds.map(i => parseInt(i)); }
        else { groupIdsInt = [parseInt(groupIds)]; }
        console.log(groupIdsInt);
        item.userIdToken = req.cookies.userid;
        db.Item.create(item).then(dbItem =>
            dbItem.setGroups(groupIdsInt).then(dbGroups => res.json(dbGroups))
                .catch(err => res.json(err))
        ).catch(err => res.json(err));
    });

    app.post('/api/groups', function (req, res) {
        db.Group.create(req.body).then(group =>
            db.User.findOne({
                where: {
                    userIdToken: req.cookies.userid
                }
            }).then(user =>
                user.addGroup(group, { through: { isAdmin: true } }).then(dbGroup => res.json(dbGroup))
            ).catch(err => res.json(err))
        ).catch(err => res.json(err));
    });

    app.put('/api/remove-member/:groupid', (req, res) => {
        console.log(req.params);
        console.log(req.body);
        db.Group.findOne({
            where: { groupId: parseInt(req.params.groupid) }, include: {
                model: db.User, where: { userIdToken: req.body.userid }
            }
        }).then(dbGroup => {
            const dbUser = dbGroup.Users[0];
            console.log(dbUser);
            dbGroup.removeUser(dbUser).then(dbResult => res.json(dbResult));
        });
    });

    app.post('/api/item-requests', function (req, res) {
        const requestInfo = req.body;
        console.log(req.body);
        const userId = req.cookies.userid;
        db.User.findOne({ where: { userIdToken: userId } }).then(function (dbCurrentUser) {
            db.Item.findOne({ where: { id: requestInfo.itemId } }).then(function (dbItem) {
                console.log(JSON.stringify(dbItem));
                let itemName = dbItem.itemName;
                const requestObject = {
                    owner: dbItem.userIdToken,
                    requester: userId,
                    item: requestInfo.itemId,
                    duration: requestInfo.duration,
                    notes: dbCurrentUser.userName + ': ' + requestInfo.notes
                };
                db.ItemRequest.create(requestObject).then(function (dbRequest) {
                    console.log(JSON.stringify(dbRequest));
                    db.User.findOne({ where: { userIdToken: dbItem.userIdToken } }).then(function (dbOwner) {
                        db.User.findOne({ where: { userIdToken: userId } }).then(function (dbRequester) {
                            let to = dbOwner.userEmail;
                            const mailOptions = {
                                from: process.env.MAILER_ADDRESS,
                                to: to,
                                subject: 'Pending Item Request',
                                text: `${dbRequester.userName} has requested your ${itemName}. Go to your profile on Something Borrowed to view the request.`,
                                html: `<p>${dbRequester.userName} has requested your ${itemName}. Click <a href="${profileLink}">here</a> to go to your profile and view the request.</p>`
                            };
                            transporter.sendMail(mailOptions, function (error, info) {
                                if (error) {
                                    console.log(error);
                                } else {
                                    console.log('Email sent: ' + info.response);
                                }
                            });
                            res.json(dbRequest);
                        });
                    });
                });
            });
        });
    });

    app.put('/api/item-requests/:status', function (req, res) {
        const requestId = req.body.requestId;
        db.ItemRequest.update({ status: req.params.status },
            { where: { id: requestId } }).then(function (dbResponse) {
            if (dbResponse.changedRows === 0) {
                res.sendStatus(404);
            }
            db.ItemRequest.findOne({
                where: { id: requestId },
                include: [db.Item, { model: db.User, as: 'holder' }, { model: db.User, as: 'applicant' }]
            }).then(function (dbItemRequest) {
                console.log('item-requests/:status dbItemRequest:', dbItemRequest);
                const status = dbItemRequest.dataValues.status;
                const ownerName = dbItemRequest.holder.dataValues.userName;
                const itemName = dbItemRequest.Item.dataValues.itemName;
                const mailOptions = {
                    from: process.env.MAILER_ADDRESS,
                    to: dbItemRequest.applicant.dataValues.userEmail,
                    subject: `Item Request ${capitalize(status)}`,
                    text: `${ownerName} has ${status} your request to borrow ${itemName}.`,
                    html: `<p>${ownerName} has ${status} your request to borrow ${itemName}.</p>`
                };
                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
                res.sendStatus(204);
            });
        });
    });

    app.put('/api/item-requests-message', function (req, res) {
        const requestId = req.body.requestId;
        const userId = req.cookies.userid;
        const message = req.body.messages;
        let chatHistory;
        db.ItemRequest.findOne({
            where: { id: requestId },
            include: [db.Item, { model: db.User, as: 'holder' }, { model: db.User, as: 'applicant' }]
        }).then(function (dbItemRequest) {
            // dbItemRequest contains owner and requester of item as holder and applicant.
            const senderIsOwner = userId === dbItemRequest.owner;
            // dbSender and dbReciever are User objects.
            const dbSender = senderIsOwner ?
                dbItemRequest.holder.dataValues : dbItemRequest.applicant.dataValues;
            const dbReciever = senderIsOwner ?
                dbItemRequest.applicant.dataValues : dbItemRequest.holder.dataValues;
            const senderName = dbSender.userName;
            const itemName = dbItemRequest.Item.dataValues.itemName;
            // Append new message to chat history.
            chatHistory = dbItemRequest.notes + '\n' + senderName + ': ' + message;
            console.log('chat           ' + chatHistory);
            // Update item request to include new message in notes.
            db.ItemRequest.update({ notes: chatHistory },
                { where: { id: requestId } }).then(function (dbResponse) {
                if (dbResponse.changedRows === 0) {
                    res.sendStatus(404);
                }
                // Send email to user to whom message was sent.
                const mailOptions = {
                    from: process.env.MAILER_ADDRESS,
                    to: dbReciever.userEmail,
                    subject: `Item Request Message`,
                    text: `There has been a message in regards to borrowing ${itemName}.`,
                    html: `<p>There has been a message in regards to borrowing ${itemName}.</p>`
                };
                transporter.sendMail(mailOptions, function (error, info) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
                res.sendStatus(204);
            });
        });
    });

    app.delete('/api/item-requests', function (req, res) {
        const requestId = req.body.id;
        db.ItemRequest.destroy({ where: { id: requestId } }).then(function (dbDeleted) {
            console.log('line 205                                ' + JSON.stringify(dbDeleted));
            if (dbDeleted === 0) {
                res.sendStatus(404);
            } else {
                res.sendStatus(200);
            }
        });
    });

    app.post('/api/group-request', (req, res) => {
        db.Group.findOne({ where: { groupId: req.body.groupId } }).then(dbGroup => {
            let groupRequest = {
                groupId: dbGroup.groupId,
                userIdToken: req.cookies.userid
            };
            console.log('dbGroup ' + JSON.stringify(dbGroup));
            db.GroupRequest.create(groupRequest).then(dbGroupRequest => {
                dbGroup.getUsers({ through: { isAdmin: true } }).then(function (dbAdministrator) {
                    console.log('dbAdministrator ' + JSON.stringify(dbAdministrator));
                    db.User.findOne({ where: { userIdToken: req.cookies.userid } }).then(function (dbRequester) {
                        console.log('dbRequester ' + JSON.stringify(dbRequester));
                        let to = dbAdministrator[0].userEmail;
                        const mailOptions = {
                            from: process.env.MAILER_ADDRESS,
                            to: to,
                            subject: 'Pending Group Request',
                            text: `${dbRequester.userName} has requested to join ${dbGroup.groupName}. Go to your profile on Something Borrowed to view the request.`,
                            html: `<p>${dbRequester.userName} has requested to join ${dbGroup.groupName}. Click <a href="${profileLink}">here</a> to go to your profile and view the request.</p>`
                        };
                        transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                                console.log(error);
                            } else {
                                console.log('Email sent: ' + info.response);
                            }
                        });
                        console.log('dbGroupRequest ' + JSON.stringify(dbGroupRequest));
                        res.json(dbGroupRequest);
                    });
                });
            });
        });
    });

    app.delete('/api/group-request/:status', (req, res) => {
        const groupRequestId = req.body.groupRequestId;
        db.GroupRequest.findOne({
            where: {
                groupRequestId: groupRequestId
            },
            include: [db.Group, db.User]
        }).then(dbGroupRequest => {
            const dbGroup = dbGroupRequest.Group;
            const groupName = dbGroup.groupName;
            const dbUser = dbGroupRequest.User;
            const to = dbUser.userEmail;
            const status = req.params.status;
            const mailOptions = {
                from: process.env.MAILER_ADDRESS,
                to: to,
                subject: `Group Request ${capitalize(status)}`,
                text: `Your request to join ${groupName} has been ${status}.`,
                html: `<p>Your request to join ${groupName} has been ${status}.</p>`
            };
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) { console.log(error); }
                else { console.log('Email sent: ' + info.response); }
                db.GroupRequest.destroy({ where: { groupRequestId: groupRequestId } }).then(() => {
                    if (status === 'approved') {
                        dbGroup.addUser(dbUser).then(dbResponse => res.json(dbResponse));
                    } else { res.sendStatus('200'); }
                });
            });
        });
    });
};

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
