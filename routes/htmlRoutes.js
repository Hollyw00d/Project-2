const db = require('../models');
module.exports = function (app) {
    app.get('/', function (req, res) {
        res.locals.metaTags = {
            title: 'Something Borrowed',
            description: 'Helping you save money through friend-to-friend lending; don\'t buy when you can borrow!',
            keywords: 'lending, borrow, friend-to-friend, save'
        };
        res.render('index', {
            loggedIn: Boolean(req.cookies.userid)
        });
    });

    app.get('/about', function (req, res) {
        res.locals.metaTags = {
            title: 'About Something Borrowed',
            description: 'Helping you save money through friend-to-friend lending; don\'t buy when you can borrow!',
            keywords: 'lending, borrow, friend-to-friend, save'
        };
        res.render('about', {
            loggedIn: Boolean(req.cookies.userid)
        });
    });

    app.get('/contact', function (req, res) {
        res.locals.metaTags = {
            title: 'Contact Something Borrowed',
            description: 'Submit this contact form to get in touch with us.',
            keywords: 'lending, borrow, friend-to-friend, save, contact'
        };
        res.render('contact', {
            loggedIn: Boolean(req.cookies.userid)
        });
    });

    app.get('/terms', function (req, res) {
        res.locals.metaTags = {
            title: 'Something Borrowed Terms',
            description: 'Created as a proof of concept for UW Coding Bootcamp.',
            keywords: 'lending, borrow, friend-to-friend, save, terms'
        };
        res.render('terms', {
            loggedIn: Boolean(req.cookies.userid)
        });
    });

    app.get('/profile', function (req, res) {
        const userId = req.cookies.userid;
        let administrates = [];
        let belongsTo = [];
        if (!userId) {
            res.render('unauthorized', {
                loggedIn: Boolean(userId),
                msg: 'You must be signed in to view your profile.'
            });
        }
        db.User.findOne({ where: { userIdToken: userId }, include: [db.Group, db.Item] }).then(dbUser => {
            if (!dbUser) {
                res.clearCookie('userid').render('index', {
                    loggedIn: Boolean(req.cookies.userid)
                });
            }
            for (let group of dbUser.Groups) {
                if (group.UserGroup.isAdmin) {
                    administrates.push(group);
                } else {
                    belongsTo.push(group);
                }
            }
            const administratesIds = administrates.map(group => group.groupId);
            const belongsToIds = belongsTo.map(group => group.groupId);
            groupMembers = [];
            db.Group.findAll({
                where: { groupId: administratesIds },
                include: db.User
            }).then(dbGroups => {
                // Find all groups this user administrates.
                for (let group of dbGroups) {
                    for (let member of group.Users) {
                        if (member.userIdToken === userId) /* Don't list self. */ { continue; }
                        member.groupId = group.groupId;
                        member.groupName = group.groupName;
                        groupMembers.push(member);
                    }
                }
            });
            let itemRequests = {
                sent: {
                    pending: [],
                    approved: [],
                    denied: []
                },
                received: {
                    pending: [],
                    approved: [],
                    denied: []
                }
            };
            db.ItemRequest.findAll({
                include: [db.Item, { model: db.User, as: 'holder' }, { model: db.User, as: 'applicant' }]
            }).then(function (dbItemRequests) {
                // Find all requests on items.
                for (let itemRequest of dbItemRequests) {
                    itemRequest.dataValues.itemName = itemRequest.Item.dataValues.itemName;
                    itemRequest.dataValues.ownerName = itemRequest.holder.dataValues.userName;
                    itemRequest.dataValues.requesterName = itemRequest.applicant.dataValues.userName;
                    if (itemRequest.dataValues.requester === userId) {
                        // User is requester.
                        itemRequests.sent[itemRequest.dataValues.status].push(itemRequest.dataValues);
                    } else if (itemRequest.dataValues.owner === userId) {
                        // User is owner.
                        itemRequests.received[itemRequest.dataValues.status].push(itemRequest.dataValues);
                    }
                }
                db.Group.findAll().then(function (dbGroups) {
                    let availableGroups = [];
                    for (let group of dbGroups) {
                        let groupId = group.groupId;
                        if (!administratesIds.includes(groupId) &&
                            !belongsToIds.includes(groupId)) {
                            availableGroups.push(group);
                        }
                    }
                    //what we still need to render profile appropriately: show requests (group name and description) that the user has requested to join and are still pending, show requests to join groups where they are the administrator, show name of person requesting to join
                    db.GroupRequest.findAll({ include: [db.User, db.Group] }).then(function (dbGroupReqests) {
                        let sentGroupRequests = [], recievedGroupRequests = [];
                        for (groupRequest of dbGroupReqests) {
                            groupRequest.requester = groupRequest.User.userName;
                            groupRequest.groupName = groupRequest.Group.groupName;
                            if (groupRequest.userIdToken === userId) { sentGroupRequests.push(groupRequest); }
                            else if (administratesIds.includes(groupRequest.groupId)) { recievedGroupRequests.push(groupRequest); }
                        }
                        // Remove groups from available groups for which a request has already been sent.
                        availableGroups = availableGroups.filter(group =>
                            !sentGroupRequests.find(request => request.groupId === group.groupId));
                        res.locals.metaTags = {
                            title: dbUser.userName + '\'s Profile',
                            description: 'See all your items available to borrow and add new items',
                            keywords: 'lending, borrow, friend-to-friend, save, view items, add items'
                        };
                        if (userId) {
                            res.render('profile', {
                                loggedIn: Boolean(userId),
                                user: dbUser,
                                items: dbUser.Items,
                                administrates: administrates,
                                belongsTo: belongsTo,
                                availableGroups: availableGroups,
                                pendingItemRequests: itemRequests.received.pending,
                                approvedItemRequests: itemRequests.received.approved,
                                pendingSentItemRequests: itemRequests.sent.pending,
                                approvedSentItemRequests: itemRequests.sent.approved,
                                deniedSentItemRequests: itemRequests.sent.denied,
                                sentGroupRequests: sentGroupRequests,
                                recievedGroupRequests: recievedGroupRequests,
                                groupMembers: groupMembers
                            });
                        } else {
                            res.render('unauthorized', {
                                loggedIn: Boolean(userId),
                                msg: 'You must be signed in to view your profile.'
                            });
                        }
                    });
                });
            });
        });
    });

    app.get('/profile/new', function (req, res) {
        const userId = req.cookies.userid;
        db.User.findAll({ where: { userIdToken: userId } }).then(function (dbUser) {
            res.locals.metaTags = {
                title: 'Create Profile',
                description: 'Complete your new profile so you can save money through friend-to-friend lending',
                keywords: 'lending, borrow, friend-to-friend, save'
            };
            if (dbUser.length === 0) {
                res.clearCookie('userid').render('index', {
                    loggedIn: Boolean(req.cookies.userid)
                });
            } else {
                if (userId) {
                    res.render('createProfile', {
                        loggedIn: Boolean(userId),
                        user: dbUser[0].dataValues
                    });
                } else {
                    res.render('unauthorized', { loggedIn: Boolean(userId), msg: 'You must sign in with Google before being able to complete your profile.', user: dbUser[0].dataValues });
                }
            }
        });
    });

    app.get('/items/:category', function (req, res) {
        const userId = req.cookies.userid;
        const selectedCategory = req.params.category;
        const keyCategory = selectedCategory.replace('-', '');
        const categoryNames = {
            all: 'All',
            books: 'Books',
            cleaningsupplies: 'Cleaning Supplies',
            electronics: 'Electronics',
            kitchen: 'Kitchen',
            miscellaneous: 'Miscellaneous',
            moviestv: 'Movies/TV',
            outdoortools: 'Outdoor Tools',
            video: 'Video Games'
        };
        db.User.findOne({ where: { userIdToken: userId }, include: db.Group }).then(dbUser => {
            if (!dbUser) {
                res.clearCookie('userid').render('index', {
                    loggedIn: Boolean(req.cookies.userid)
                });
            }
            const groupIds = dbUser.Groups.map(group => group.groupId);
            db.Group.findAll({
                where: {
                    groupId: groupIds
                }, include: db.Item
            }).then(dbGroups => {
                itemIds = new Set();
                dbItems = [];
                dbGroups.forEach(dbGroup => {
                    dbGroup.Items.forEach(
                        item => {
                            if ((selectedCategory === 'all' || item.itemCategory === selectedCategory) &&
                                !itemIds.has(item.id) && item.userIdToken !== userId) {
                                dbItems.push(item);
                                itemIds.add(item.id);
                            }
                        });
                });
                res.render('items', {
                    category: categoryNames[`${keyCategory}`],
                    loggedIn: Boolean(userId),
                    items: dbItems
                });

            });
        });
    });

    app.get('/search/:query', function (req, res) {
        const userId = req.cookies.userid;
        const searchQuery = req.params.query;
        db.User.findOne({ include: db.Group }).then(dbUser => {
            const groupIds = dbUser.Groups.map(group => group.groupId);
            db.Group.findAll({
                where: {
                    groupId: groupIds
                }, include: db.Item
            }).then(dbGroups => {
                itemIds = new Set();
                dbItems = [];
                dbGroups.forEach(dbGroup => {
                    dbGroup.Items.forEach(
                        item => {
                            if ((item.itemName === searchQuery) &&
                                !itemIds.has(item.id)) {
                                dbItems.push(item);
                                itemIds.add(item.id);
                            }
                        });
                });
                res.render('items', {
                    query: searchQuery,
                    loggedIn: Boolean(userId),
                    items: Array.from(dbItems)
                });

            });
        });
    });

    app.get('*', function (req, res) {
        res.locals.metaTags = {
            title: 'Error',
            description: 'Page not found.',
            keywords: 'error'
        };
        res.render('404', { loggedIn: Boolean(req.cookies.userid) });
    });


};
